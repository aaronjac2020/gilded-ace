"""Export outputs to web/public/data/*.json (columnar). No player-level rows ever leave this module.

Columnar format: {"columns": [...], "data": {col: [...]}, "dicts": {col: [values]}}.
Columns listed in "dicts" hold integer codes into that list (dictionary encoding keeps the
machine-day table small). Money rounded to cents, rates to 4 dp.
"""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime

import numpy as np
import pandas as pd

from pipeline import budget, claims, comps, demand, downtime, players, verdicts
from pipeline.config import OUTPUTS, WEB_DATA, cfg, periods
from pipeline.load import machine_days, table

RATE_COLS = (
    "top1",
    "top10",
    "gini",
    "earn_rate",
    "cost_per_face",
    "winners",
    "availability",
    "hold",
    "luck_z",
    "effect",
    "share",
    "_z",
    "weight",
    "tau",
    "rtp",
    "_p",
    "wape",
    "pct",
    "uplift",
)
PENDING: dict[str, str] = {}


def _round(col: str, s: pd.Series) -> pd.Series:
    if not pd.api.types.is_float_dtype(s):
        return s
    nd = 6 if col in ("reinvestment", "earn_rate") else 4 if any(k in col for k in RATE_COLS) else 2
    return s.round(nd)


def _clean(v):
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    if isinstance(v, (np.floating,)):
        return None if not np.isfinite(v) else float(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    if isinstance(v, (pd.Timestamp, datetime)):
        return v.strftime("%Y-%m-%d")
    return v


def columnar(df: pd.DataFrame, encode: tuple[str, ...] = ()) -> dict:
    """DataFrame -> columnar dict; `encode` columns are dictionary-encoded."""
    out: dict = {"columns": list(df.columns), "data": {}}
    dicts = {}
    for c in df.columns:
        s = df[c]
        if pd.api.types.is_datetime64_any_dtype(s):
            s = s.dt.strftime("%Y-%m-%d")
        if c in encode:
            cat = pd.Categorical(s)
            dicts[c] = [_clean(x) for x in cat.categories]
            out["data"][c] = cat.codes.tolist()
            continue
        out["data"][c] = [_clean(x) for x in _round(c, s).tolist()]
    if dicts:
        out["dicts"] = dicts
    return out


def write(name: str, obj) -> int:
    WEB_DATA.mkdir(parents=True, exist_ok=True)
    p = WEB_DATA / name
    p.write_text(json.dumps(obj, separators=(",", ":"), default=_clean, allow_nan=False), encoding="utf-8")
    return p.stat().st_size


def floor() -> dict:
    loc = table("floor_locations")
    slots = loc[loc.node_type == "slot"][["location_id", "zone_id", "bank_id", "x_m", "y_m"]]
    banks = loc[loc.node_type == "bank"][["location_id", "zone_id", "x_m", "y_m", "capacity"]].rename(
        columns={"location_id": "bank_id"}
    )
    zones = loc[loc.node_type == "zone"][["location_id", "name", "x_m", "y_m"]].rename(columns={"location_id": "zone_id"})
    other = loc[loc.node_type.isin(["entrance", "outlet"])][["location_id", "node_type", "zone_id", "name", "x_m", "y_m"]]
    ww = table("floor_walkways").copy()
    return {
        "slots": columnar(slots),
        "banks": columnar(banks),
        "zones": columnar(zones),
        "landmarks": columnar(other),
        "walkways": columnar(ww),
    }


def machine_day_slim() -> dict:
    md = machine_days()
    d0 = pd.Timestamp(cfg_start())
    slim = pd.DataFrame(
        {
            "machine_id": md["machine_id"],
            "d": (md["gaming_date"] - d0).dt.days.astype(int),
            "location_id": md["location_id"],
            "zone": md["zone_id"],
            "bank": md["bank_id"],
            "coin_in": md["coin_in_usd"],
            "house_win": md["house_win_usd"],
            "theo": md["theo_usd"],
            "available_hours": md["available_hours"],
            "scheduled_hours": md["scheduled_hours"],
        }
    ).sort_values(["d", "machine_id"])
    out = columnar(slim, encode=("machine_id", "location_id", "zone", "bank"))
    out["date0"] = str(d0.date())
    return out


def cfg_start() -> str:
    return str(periods()["full"][0])


def lists(full: pd.DataFrame) -> dict:
    keep = [
        "machine_id",
        "zone_id",
        "bank_id",
        "theme",
        "house_win_usd",
        "theo_usd",
        "hold_obs",
        "hold_expected",
        "machine_effect_shrunk",
        "verdict",
        "verdict_reason",
    ]
    mgr = verdicts.manager_list(full).reset_index()
    ours, _ = verdicts.truly_weak_list(full)
    return {"period": "full", "manager": columnar(mgr[keep]), "ours": columnar(ours.reset_index()[keep])}


def model_lab() -> dict:
    m = json.loads((OUTPUTS / "metrics.json").read_text(encoding="utf-8"))
    fh = pd.read_parquet(OUTPUTS / "forecast_holdout.parquet")
    s = cfg()["split"]
    return {
        "split": s,
        "model2": {
            k: m["model2"][k]
            for k in (
                "mae_model",
                "mae_weekday_only",
                "mae_baseline",
                "wape_model",
                "wape_baseline",
                "improvement_pct",
                "event_uplift",
                "bias_model",
                "peak_days",
                "trough_days",
            )
        },
        "model2_holdout": columnar(fh),
        "model1": m.get("model1"),
        "persistence": m.get("persistence"),
        "persistence_compare": m.get("persistence_compare"),
        # resampling pools stay in metrics.json; the page only needs their spread
        "alternatives": {
            k: ({kk: vv for kk, vv in v.items() if not kk.endswith("draws")} if k == "move_noise" else v)
            for k, v in (m.get("alternatives") or {}).items()
        },
        "move_test_pick": (m.get("move_test") or {}).get("pick"),
        "model1_change": m.get("model1_change"),
    }


def budget_json(full: pd.DataFrame) -> dict:
    cat = budget.catalog().reset_index()
    keep = [
        "action_type_id",
        "name",
        "unit",
        "unit_cost_usd",
        "recurring_usd_per_day",
        "lead_days",
        "live_days",
        "unit_total_usd",
        "downtime_minutes",
        "quantity_limit",
        "incompatibility_group",
        "notes",
    ]
    m = json.loads((OUTPUTS / "metrics.json").read_text(encoding="utf-8"))
    s = budget.plan_summary(full, m.get("alternatives"))
    return {
        "rules": {k: cfg()["budget"][k] for k in ("total_usd", "horizon_days", "max_action_types")},
        "formula": "cost = quantity x (unit_cost + recurring_per_day x max(0, horizon_days - lead_days))",
        "catalog": columnar(cat[keep]),
        "recommended": columnar(s["lines"]),
        "pool": columnar(s["pool"]),
        "optimizer_pick": s["optimizer_pick"],
        "sensitivity": columnar(pd.DataFrame(s["sensitivity"])) if s["sensitivity"] else None,
        "total_usd": s["total_usd"],
        "kept_usd": s["kept_usd"],
        "effect": s["effect"],
        "errors": s["errors"],
        "move_test": m.get("move_test"),
        "version": "v1",
    }


MONTH_ABBR = {"01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr", "05": "May", "06": "Jun"}


def month_highlights(sc: pd.DataFrame) -> dict:
    """Up to 3 neutral "what changed" lines per month for the Verdict panel (presentation only)."""
    months = sorted(p for p in sc.period.unique() if len(p) == 7 and p[4] == "-")
    pl = table("placements")
    first = pl.effective_from_utc.min()
    moves = pl[pl.effective_from_utc > first]
    ww = table("floor_walkways")
    out: dict[str, list[str]] = {}
    prev_theo, prev_name = None, ""
    for m in months:
        _, mo = m.split("-")
        lo = pd.Timestamp(f"{m}-01")
        hi = lo + pd.offsets.MonthBegin(1)
        name = MONTH_ABBR.get(mo, m)
        lines: list[str] = []
        for _, w in ww.iterrows():
            for col, verb in (("closed_from_utc", "closed"), ("closed_to_utc", "reopened")):
                t = w[col]
                if pd.notna(t) and lo <= t < hi:
                    lines.append(f"Walkway {w.walkway_id} {verb} {t.strftime('%b')} {t.day}")
        mv = moves[(moves.effective_from_utc >= lo) & (moves.effective_from_utc < hi)]
        if len(mv):
            n = mv.machine_id.nunique()
            lines.append(f"{n} machine{'s' if n != 1 else ''} moved to a new spot")
        cur = sc[sc.period == m]
        by_bank = cur.groupby("bank_id").lost_theo_usd.sum().sort_values(ascending=False)
        if len(by_bank) and by_bank.iloc[0] > 0:
            lines.append(f"Most theo lost to downtime: {by_bank.index[0]} (${by_bank.iloc[0] / 1000:,.1f}k)")
        theo = float(cur.theo_usd.sum())
        if prev_theo:
            d = (theo - prev_theo) / prev_theo
            lines.append(f"Floor theo ${theo / 1000:,.0f}k, {'up' if d >= 0 else 'down'} {abs(d):.0%} vs. {prev_name}")
        else:
            lines.append(f"Floor theo ${theo / 1000:,.0f}k")
        prev_theo, prev_name = theo, name
        out[m] = lines[:3]
    return {"months": out}


def demand_json() -> dict:
    """Daily floor + traffic (offline hours masked, then imputed from zone x weekday x hour), zone shares, events, city context."""
    d0 = pd.Timestamp(cfg_start())
    d = demand.daily()
    z = demand.zone_hourly()
    zd = demand.zone_daily(z)
    d.drop(columns=["events"]).assign(events=d["events"].str.join(",")).to_parquet(OUTPUTS / "demand_daily.parquet", index=False)
    day = pd.DataFrame(
        {
            "d": (d["gaming_date"] - d0).dt.days,
            "weekday": d["local_weekday"],
            "coin_in": d["coin_in_usd"],
            "theo": d["theo_usd"],
            "house_win": d["house_win_usd"],
            "occupied_hours": d["occupied_machine_hours"],
            "traffic": d["traffic_est"],
            "entrance": d["entrance_est"],
            "masked_hours": d["masked_hours"],
            "fnb_cash": d["pos_cash_usd"],
            "fnb_cogs": d["pos_cogs_usd"],
            "comp_face": d["comp_face_value_usd"],
            "tmax_c": d["tmax_c"],
            "prcp_mm": d["prcp_mm"],
            "holiday": d["federal_holiday"],
            "events": d["events"].str.join(","),
        }
    )
    zday = pd.DataFrame(
        {
            "d": (zd["gaming_date"] - d0).dt.days,
            "zone": zd["zone_id"],
            "entries": zd["entries_est"],
            "masked_hours": zd["masked_hours"],
        }
    )
    w = demand.walkway_closures()
    closures = []
    for r in w.itertuples():
        a = (pd.Timestamp(r.closed_from_utc).normalize() - d0).days
        b = (pd.Timestamp(r.closed_to_utc).normalize() - d0).days
        tot = zday.groupby("d")["entries"].sum()
        share = {k: zday[zday.zone == k].set_index("d")["entries"] / tot for k in (r.zone_a, r.zone_b)}
        inside = (tot.index >= a) & (tot.index <= b)
        closures.append(
            {
                "walkway_id": r.walkway_id,
                "zones": [r.zone_a, r.zone_b],
                "reason": r.closure_reason,
                "d_from": a,
                "d_to": b,
                "share": {k: {"during": float(v[inside].mean()), "outside": float(v[~inside].mean())} for k, v in share.items()},
            }
        )
    zones = table("floor_locations").query("node_type == 'zone'")[["zone_id", "name"]]
    return {
        "date0": cfg_start(),
        "daily": columnar(day, encode=("weekday",)),
        "zone_daily": columnar(zday, encode=("zone",)),
        "zone_hour": columnar(demand.zone_hour_profile(z), encode=("month", "zone_id")),
        "events": columnar(demand.event_uplift(d)),
        "closures": closures,
        "city": columnar(demand.city_context()),
        "zones": columnar(zones),
        "notes": {
            "traffic": "Door-counter entries. Offline hours are masked, then filled from the same zone, weekday and hour; partial hours are scaled to 60 minutes.",
            "city": "LVCVA city visitation and NOAA weather are context only; they are not inputs to any model.",
            "uplift": "Event days vs same-weekday non-event days within 28 days; ratio of means, bootstrap 90% interval.",
        },
    }


def downtime_json(full: pd.DataFrame) -> dict:
    """Machine-day lost theo by bank (lo/mid/hi), fault tickets with wait and down hours, slot-tech staffing by shift."""
    d0 = pd.Timestamp(cfg_start())
    md = downtime.machine_day_losses(machine_days())
    g = md.groupby(["gaming_date", "bank_id", "zone_id"], as_index=False).agg(
        unavailable_hours=("unavailable_hours", "sum"),
        faults=("faults_opened", "sum"),
        lost_lo=("lost_theo_lo_usd", "sum"),
        lost_mid=("lost_theo_mid_usd", "sum"),
        lost_hi=("lost_theo_hi_usd", "sum"),
    )
    g = g.assign(d=(g["gaming_date"] - d0).dt.days).drop(columns=["gaming_date"])
    t = downtime.tickets(full["theo_per_avail_hr"])
    t.to_parquet(OUTPUTS / "downtime_tickets.parquet", index=False)
    tk = pd.DataFrame(
        {
            "machine_id": t["machine_id"],
            "d": (t["gaming_date"] - d0).dt.days,
            "opened": t["opened_at_local"].dt.strftime("%Y-%m-%d %H:%M"),
            "bank": t["bank_id"],
            "zone": t["zone_id"],
            "shift": t["shift"],
            "wait_hours": t["wait_hours"],
            "down_hours": t["down_hours"],
            "repair_cost": t["repair_cost_usd"],
            "lost_theo": t["lost_theo_usd"],
        }
    )
    return {
        "date0": cfg_start(),
        "bank_day": columnar(
            g[["d", "bank_id", "zone_id", "unavailable_hours", "faults", "lost_lo", "lost_mid", "lost_hi"]],
            encode=("bank_id", "zone_id"),
        ),
        "tickets": columnar(tk, encode=("machine_id", "bank", "zone", "shift")),
        "staffing": columnar(downtime.staffing()),
        "notes": {
            "lost": "Lost theo = unavailable hours x the machine's same-weekday coin-in per available hour x (1 - RTP); range from the 25th-75th percentile of its daily rates.",
            "tickets": "Per-ticket lost theo uses the machine's average theo per available hour, so night (grave) tickets are an upper estimate: night play is lighter.",
        },
    }


def players_json() -> dict:
    """Segment x period stats (exact top shares, Lorenz, Gini, net histogram) + tier x region x age x month cube.

    Aggregates only: every row sums over players. Segments are one dimension at a time.
    """
    pm = players.player_months()
    st = players.segment_table(pm)
    st.drop(columns=["lorenz_theo", "net_hist"]).to_parquet(OUTPUTS / "players_segments.parquet", index=False)
    c = players.cube(pm)
    edges = [None if not np.isfinite(e) else float(e) for e in players.NET_EDGES]
    return {
        "dims": {k: sorted(pm[v].dropna().unique().tolist(), key=str) for k, v in players.DIMS.items()},
        "tier_order": players.TIER_ORDER,
        "segments": columnar(st, encode=("period", "segment")),
        "cube": columnar(c, encode=("month", "tier", "region", "age")),
        "net_edges": edges,
        "notes": {
            "unit": "One player = one carded player id, summed over the period's months. Net = payout - coin-in (player's view; negative = loss).",
            "tier": "Tier is the tier at enrolment or Jan 1 (opening tier), so a player stays in one segment all period.",
            "privacy": "Only aggregates over players are published; no player ids or player-level rows.",
        },
    }


def comps_json() -> dict:
    """Weekly reinvestment + loyalty rates, change points with block-bootstrap CIs, comp cost by month x tier x region."""
    w = comps.weekly()
    w.to_parquet(OUTPUTS / "comps_weekly.parquet", index=False)
    cps = {}
    for col in ("reinvestment", "points_per_dollar", "earn_rate", "cost_per_face"):
        cp = comps.change_point(w[col].to_numpy())
        weeks = w["week"].dt.strftime("%Y-%m-%d")
        cps[col] = {**cp, "week": weeks.iloc[cp["k"]], "week_lo": weeks.iloc[cp["k_lo"]], "week_hi": weeks.iloc[cp["k_hi"]]}
    return {
        "weekly": columnar(w.drop(columns=["days"])),
        "change_points": cps,
        "by_segment": columnar(comps.by_segment(), encode=("month", "tier", "region")),
        "fnb": comps.fnb_cash_margin(),
        "notes": {
            "cost": "Comp cost = economic cost of redemptions in the loyalty ledger (what the comp costs the property), not face value.",
            "double_count": "Comped F&B rows carry COGS equal to the ledger's economic cost; F&B margin here uses paid rows only so comps are counted once.",
            "change_point": "One mean shift in the weekly series, chosen by least squared error (>= 4 weeks each side). 90% CIs from a moving-block bootstrap (3-week blocks) of residuals; 'chance' = largest shift a split finds in the same series with no break.",
            "weeks": "Full Monday-start gaming weeks only (Jan 6 - Jun 29).",
        },
    }


def run() -> dict[str, int]:
    """Write every web JSON; returns {file: bytes}. Raises if the total exceeds web.max_total_mb."""
    sizes: dict[str, int] = {}
    sc = pd.read_parquet(OUTPUTS / "machine_scorecard.parquet")
    for name in periods():
        p = sc[sc.period == name].drop(columns=["period"])
        sizes[f"scorecard_{name}.json"] = write(f"scorecard_{name}.json", columnar(p))
    full = sc[sc.period == "full"].set_index("machine_id")

    mach = table("machines").merge(
        full[["config_id", "volatility_class", "configured_rtp"]].reset_index(), on="machine_id", how="left"
    )
    sizes["machines.json"] = write("machines.json", columnar(mach))
    sizes["floor.json"] = write("floor.json", floor())
    pl = table("placements")[["machine_id", "location_id", "config_id", "effective_from_utc", "effective_to_utc"]]
    sizes["placements.json"] = write("placements.json", columnar(pl))
    sizes["machine_day_slim.json"] = write("machine_day_slim.json", machine_day_slim())
    sizes["lists.json"] = write("lists.json", lists(full))
    sizes["model_lab.json"] = write("model_lab.json", model_lab())
    sizes["budget.json"] = write("budget.json", budget_json(full))
    sizes["month_highlights.json"] = write("month_highlights.json", month_highlights(sc))
    sizes["demand.json"] = write("demand.json", demand_json())
    sizes["downtime.json"] = write("downtime.json", downtime_json(full))
    sizes["players_segments.json"] = write("players_segments.json", players_json())
    sizes["comps.json"] = write("comps.json", comps_json())
    cl = claims.build()  # reads the exports above; keep last
    (claims.ROOT / "docs" / "claims_appendix.md").write_text(claims.markdown(cl), encoding="utf-8")
    sizes["claims.json"] = write("claims.json", {"claims": cl, "approved": claims.APPROVED})
    for f, ms in PENDING.items():
        if not (WEB_DATA / f).exists() or json.loads((WEB_DATA / f).read_text(encoding="utf-8")).get("pending"):
            sizes[f] = write(f, {"pending": ms})
        else:
            sizes[f] = (WEB_DATA / f).stat().st_size

    meta = {
        "build_time": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "data_version": json.loads((cfg()["data_dir"] / "data" / "manifest.json").read_text(encoding="utf-8"))["version"],
        "seed": cfg()["seed"],
        "periods": {k: [str(a), str(b)] for k, (a, b) in periods().items()},
        "row_counts": {"machines": int(len(mach)), "machine_days": int(len(machine_days())), "scorecard": int(len(sc))},
        "rules": {
            "low_hold_design": cfg()["verdicts"]["low_hold_design"],
            "floor_median_hold": float(full["hold_expected"].median()),
        },
        # presentation only: lets web/src/lib/reasons.ts re-derive each verdict rule's mask (checked by consistency.mjs)
        "verdict_rules": {
            k: cfg()["verdicts"][k]
            for k in ("luck_z", "downtime_avail_quantile", "downtime_gap_share", "location_quantile", "theo_hr_low_quantile")
        },
    }
    sizes["meta.json"] = write("meta.json", meta)
    total = sum(sizes.values())
    cap = cfg()["web"]["max_total_mb"] * 1024 * 1024
    if total > cap:
        raise SystemExit(f"web export {total / 1e6:.1f} MB exceeds {cfg()['web']['max_total_mb']} MB")
    return sizes


if __name__ == "__main__":
    s = run()
    for k, v in sorted(s.items(), key=lambda kv: -kv[1]):
        print(f"  {k:<28} {v / 1024:>9.1f} KB")
    print(f"  {'TOTAL':<28} {sum(s.values()) / 1024 / 1024:>9.2f} MB  (cap {cfg()['web']['max_total_mb']} MB)")
