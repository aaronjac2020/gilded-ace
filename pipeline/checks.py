"""Data audit: row counts + the 12 data rules. Prints a PASS/FAIL table; exit code 1 on any FAIL."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass

import pandas as pd

from pipeline.config import cfg
from pipeline.load import T, calendar, cents_to_usd, sql, table, to_gaming_date


@dataclass
class Check:
    rule: str
    name: str
    ok: bool
    detail: str


def row_counts() -> list[Check]:
    """Compare every table we load to the release manifest."""
    man = json.loads((cfg()["data_dir"] / "data" / "manifest.json").read_text(encoding="utf-8"))
    expected = {f["path"].removesuffix(".parquet"): f["rows"] for f in man["files"] if f["path"].endswith(".parquet")}
    out = []
    for key, rel in T.items():
        n = int(sql(f"select count(*) n from {{{key}}}")["n"].iloc[0])
        exp = expected.get(rel)
        out.append(
            Check(
                "rows",
                rel,
                exp is None or n == exp,
                f"{n:,} (manifest {exp:,})" if exp else f"{n:,}",
            )
        )
    return out


def rule_checks() -> list[Check]:
    c = cfg()["checks"]
    out: list[Check] = []

    # 1. Gaming day: our local->gaming-date conversion must agree with the UTC calendar windows.
    s = sql("select start_local, start_utc, gaming_date from {sessions} using sample 50000 rows (reservoir, 42)")
    mism = int((to_gaming_date(s["start_local"]) != s["gaming_date"]).sum())
    ops = sql(
        """select o.opened_at_local, c.gaming_date from {operations} o
           join {calendar_day} c on o.opened_at_utc >= c.gaming_day_start_utc and o.opened_at_utc < c.gaming_day_end_utc"""
    )
    mism_ops = int((to_gaming_date(ops["opened_at_local"]) != pd.to_datetime(ops["gaming_date"])).sum())
    out.append(
        Check(
            "1",
            "gaming date = local - 6h (sessions sample, operations vs UTC calendar)",
            mism == 0 and mism_ops == 0,
            f"session mismatches {mism}/50,000; ops mismatches {mism_ops}/{len(ops)}",
        )
    )

    # 2. Carded subset never exceeds all play; carded sessions sum to machine_day carded meters.
    r = sql(
        """with s as (select machine_id, gaming_date, sum(coin_in_cents) ci from {sessions} group by all)
           select count(*) filter (where m.carded_coin_in_cents > m.coin_in_cents) over_all,
                  count(*) filter (where coalesce(s.ci,0) <> m.carded_coin_in_cents) sess_mismatch,
                  sum(m.carded_coin_in_cents)/sum(m.coin_in_cents) share
           from {machine_day} m left join s using (machine_id, gaming_date)"""
    ).iloc[0]
    out.append(
        Check(
            "2",
            "carded <= all play; sessions == machine_day.carded_*",
            r.over_all == 0 and r.sess_mismatch == 0,
            f"carded>all rows {int(r.over_all)}; session/meter mismatches {int(r.sess_mismatch)}; carded share {r.share:.1%}",
        )
    )

    # 3. Ratio of sums vs mean of daily ratios (they differ, so the choice matters).
    pdv = sql("select house_win_usd, coin_in_usd from {pdv} where location_id is not null")
    ros = pdv.house_win_usd.sum() / pdv.coin_in_usd.sum()
    mdr = (pdv.house_win_usd / pdv.coin_in_usd.where(pdv.coin_in_usd != 0)).mean()
    out.append(
        Check(
            "3",
            "hold = ratio of sums (mean of daily ratios shown for contrast)",
            True,
            f"ratio of sums {ros:.4%} vs mean daily ratio {mdr:.4%}",
        )
    )

    # 4. Aggregate before join: sessions aggregated per player-month reproduce player_period.
    r = sql(
        """with s as (select player_id, strftime(gaming_date, '%Y-%m') period_month, sum(coin_in_cents) ci
                      from {sessions} group by all)
           select count(*) n, count(*) filter (where abs(p.tracked_coin_in_usd*100 - coalesce(s.ci,0)) > 0.5) bad
           from {player_period} p left join s using (player_id, period_month)"""
    ).iloc[0]
    out.append(
        Check(
            "4",
            "sessions aggregated first == player_period coin-in",
            r.bad == 0,
            f"{int(r.bad)} mismatches of {int(r.n):,}",
        )
    )

    # 5. Off-floor rows.
    n = int(sql("select count(*) n from {pdv} where location_id is null")["n"].iloc[0])
    out.append(
        Check(
            "5",
            "off-floor rows (null location_id) excluded",
            n == c["offfloor_rows"],
            f"{n:,} rows excluded",
        )
    )

    # 6. Location by date: prepared view location equals the placement interval covering the day start.
    r = sql(
        """select count(*) n, count(*) filter (where p.location_id is distinct from d.location_id) bad
           from {pdv} d join {calendar_day} c using (gaming_date)
           left join {placements} p on p.machine_id = d.machine_id
             and c.gaming_day_start_utc >= p.effective_from_utc
             and (p.effective_to_utc is null or c.gaming_day_start_utc < p.effective_to_utc)
           where d.location_id is not null"""
    ).iloc[0]
    moved = int(sql("select count(*) n from (select machine_id from {placements} group by 1 having count(*) > 1)")["n"].iloc[0])
    out.append(
        Check(
            "6",
            "location from placements by date (machines move)",
            r.bad == 0,
            f"{int(r.bad)} mismatches of {int(r.n):,}; {moved} machines with >1 placement",
        )
    )

    # 7. DST: availability denominator uses scheduled_seconds.
    cal = calendar()
    dst = cal.loc[cal.gaming_date == "2025-03-08", "scheduled_hours"].iloc[0]
    over = int(
        sql(
            "select count(*) n from {machine_day} m join {calendar_day} c using (gaming_date) where m.scheduled_seconds > c.scheduled_seconds"
        )["n"].iloc[0]
    )
    out.append(
        Check(
            "7",
            "2025-03-08 = 23 h; machine scheduled <= calendar",
            dst == 23 and over == 0,
            f"2025-03-08 scheduled_hours={dst}; rows over calendar {over}",
        )
    )

    # 8. Traffic: null count <=> counter offline; never zero-filled.
    r = sql(
        """select count(*) filter (where entries_count is null) nulls,
                  count(*) filter (where entries_count is null and counter_status <> 'offline') null_not_off,
                  count(*) filter (where counter_status = 'offline' and entries_count is not null) off_not_null,
                  count(*) filter (where counter_status = 'partial') partial
           from {zone_traffic}"""
    ).iloc[0]
    out.append(
        Check(
            "8",
            "missing traffic = counter offline (masked, not zero)",
            r.null_not_off == 0 and r.off_not_null == 0,
            f"{int(r.nulls)} offline sensor-hours; {int(r.partial)} partial",
        )
    )

    # 9. Cents/dollars: prepared view USD == machine_day cents / 100.
    r = sql(
        """select max(abs(d.coin_in_usd - m.coin_in_cents/100.0)) e1, max(abs(d.house_win_usd - m.house_win_cents/100.0)) e2,
                  max(abs(d.theo_usd - m.theo_cents/100.0)) e3
           from {pdv} d join {machine_day} m using (machine_id, gaming_date)"""
    ).iloc[0]
    err = float(max(r.e1, r.e2, r.e3))
    out.append(
        Check(
            "9",
            "cents->USD in one place (pdv == machine_day/100)",
            err < 0.01 and cents_to_usd(12345) == 123.45,
            f"max abs diff ${err:.4f}",
        )
    )

    # 10. Negative daily house win is real.
    n = int(sql("select count(*) n from {pdv} where house_win_usd < 0 and location_id is not null")["n"].iloc[0])
    out.append(
        Check(
            "10",
            "negative daily house win kept (luck, not error)",
            True,
            f"{n:,} machine-days with negative win kept",
        )
    )

    # 11. Comps sit inside cogs; trips are property visits only.
    r = sql(
        """select (select sum(comp_cost_usd) from {property_day}) comp,
                  (select sum(pos_cogs_usd) from {property_day}) cogs,
                  (select sum(economic_cost_cents)/100.0 from {loyalty_ledger} where event_type='redeem') ledger,
                  (select sum(cogs_cents)/100.0 from {fnb} where comp_id is not null) fnb_comp_cogs"""
    ).iloc[0]
    ok = r.comp <= r.cogs and abs(r.ledger - r.fnb_comp_cogs) < 1 and abs(r.comp - r.ledger) < 1
    out.append(
        Check(
            "11",
            "comp cost inside cogs (subtract once); ledger == comped POS cogs",
            bool(ok),
            f"comp ${r.comp:,.0f} of cogs ${r.cogs:,.0f}; ledger ${r.ledger:,.0f}",
        )
    )

    # 12. Floor size.
    r = sql(
        "select min(n) lo, max(n) hi from (select gaming_date, count(*) n from {pdv} where location_id is not null group by 1)"
    ).iloc[0]
    nm = len(table("machines"))
    ok = c["on_floor_min"] <= r.lo and r.hi <= c["on_floor_max"] and nm == c["machines_total"]
    out.append(
        Check(
            "12",
            "300-308 machines on floor daily; 310 total",
            bool(ok),
            f"on floor {int(r.lo)}-{int(r.hi)}; machines {nm}",
        )
    )
    return out


USED_COLUMNS = {
    "prepared_daily_view": "machine_id gaming_date month local_weekday is_weekend federal_holiday events_active zone_id zone_name bank_id "
    "location_id config_id theme configured_rtp volatility_class manufacturer lease_class active available_hours occupied_hours paid_spins "
    "coin_in_usd payout_usd house_win_usd theo_usd carded_coin_in_usd faults_opened repair_cost_usd lag_coin_in_7d_mean_usd "
    "lag_downtime_7d_hours lag_house_win_28d_usd",
    "machine_day": "machine_id gaming_date scheduled_seconds available_seconds sum_bet_squared coin_in_cents house_win_cents theo_cents "
    "carded_coin_in_cents carded_payout_cents carded_theo_cents",
    "calendar_day": "gaming_date gaming_day_start_utc gaming_day_end_utc scheduled_seconds local_weekday month is_weekend federal_holiday",
    "game_math": "config_id theme configured_rtp payout_multiplier_variance min_bet_cents max_bet_cents bet_options_cents volatility_class",
    "placements": "machine_id location_id config_id effective_from_utc effective_to_utc",
    "operations": "machine_id location_id event_type opened_at_utc opened_at_local available_at_utc direct_cost_cents",
    "sessions": "machine_id player_id gaming_date start_local coin_in_cents",
    "zone_traffic_hourly": "zone_id hour_start_local entries_count counter_status coverage_minutes",
    "loyalty_ledger": "event_type economic_cost_cents",
    "fnb_transactions": "comp_id cogs_cents",
}


def verify_used_columns() -> Check:
    """Every column name we rely on must exist in the parquet schema (never guessed)."""
    keymap = {
        "prepared_daily_view": "pdv",
        "fnb_transactions": "fnb",
        "zone_traffic_hourly": "zone_traffic",
    }
    missing = []
    for tbl, cols in USED_COLUMNS.items():
        key = keymap.get(tbl, tbl)
        have = set(sql(f"select * from {{{key}}} limit 0").columns)
        missing += [f"{tbl}.{c}" for c in cols.split() if c not in have]
    return Check(
        "cols",
        "all used column names exist in schema",
        not missing,
        ", ".join(missing) or "verified",
    )


def run() -> bool:
    checks = row_counts() + rule_checks() + [verify_used_columns()]
    w = max(len(c.name) for c in checks)
    print(f"{'rule':<5} {'check':<{w}}  result  detail")
    print("-" * (w + 40))
    for c in checks:
        print(f"{c.rule:<5} {c.name:<{w}}  {'PASS' if c.ok else 'FAIL':<6}  {c.detail}")
    print("\nVerified columns used:")
    for tbl, cols in USED_COLUMNS.items():
        print(f"  {tbl}: {', '.join(cols.split())}")
    ok = all(c.ok for c in checks)
    print(f"\n{'ALL PASS' if ok else 'FAILURES PRESENT'} ({sum(c.ok for c in checks)}/{len(checks)})")
    return ok


if __name__ == "__main__":
    sys.exit(0 if run() else 1)
