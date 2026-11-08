"""Demand: when and where play happens. Daily floor totals, zone traffic (offline hours masked), events and city context."""

from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.load import GAMING_DAY_START_HOUR, sql, table

WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _gaming_date(local: pd.Series) -> pd.Series:
    return (local - pd.Timedelta(hours=GAMING_DAY_START_HOUR)).dt.normalize()


def zone_hourly() -> pd.DataFrame:
    """Hourly zone entries with offline hours masked (NaN), partial hours scaled to 60 min, and an imputed estimate.

    est = observed rate where covered, else the zone's mean rate for that weekday x hour over covered hours.
    """
    z = table("zone_traffic")[
        ["zone_id", "hour_start_local", "local_hour", "entries_count", "counter_status", "coverage_minutes"]
    ].copy()
    z["gaming_date"] = _gaming_date(z["hour_start_local"])
    z["weekday"] = z["gaming_date"].dt.dayofweek
    covered = z["coverage_minutes"] > 0
    z["rate"] = np.where(covered, z["entries_count"] * 60.0 / z["coverage_minutes"].where(covered), np.nan)
    z["masked"] = ~covered
    fill = z.groupby(["zone_id", "weekday", "local_hour"])["rate"].transform("mean")
    z["est"] = z["rate"].fillna(fill)
    return z


def zone_daily(z: pd.DataFrame) -> pd.DataFrame:
    g = z.groupby(["gaming_date", "zone_id"])
    return pd.DataFrame(
        {"entries_est": g["est"].sum(), "entries_observed": g["rate"].sum(min_count=1), "masked_hours": g["masked"].sum()}
    ).reset_index()


def events_by_day(days: pd.Series) -> pd.Series:
    ev = table("events")
    out = pd.Series([[] for _ in days], index=days)
    for e in ev.itertuples():
        for d in pd.date_range(e.start_date, e.end_date):
            if d in out.index:
                out[d] = [*out[d], e.event_id]
    return out


def daily() -> pd.DataFrame:
    """One row per gaming day: floor money, traffic estimate, F&B, events, weather, holiday."""
    p = sql(
        """
        select p.gaming_date, p.local_weekday, p.coin_in_usd, p.theo_usd, p.house_win_usd, p.occupied_machine_hours,
               p.available_machine_hours, p.pos_cash_usd, p.pos_cogs_usd, p.comp_face_value_usd,
               p.counter_coverage_share, c.is_weekend, c.federal_holiday,
               w.tmax_c, w.prcp_mm
        from {property_day} p
        join {calendar_day} c using (gaming_date)
        left join {weather} w on w.source_date = p.gaming_date
        order by 1
        """
    )
    p["gaming_date"] = pd.to_datetime(p["gaming_date"])
    zd = zone_daily(zone_hourly())
    t = zd.groupby("gaming_date").agg(traffic_est=("entries_est", "sum"), masked_hours=("masked_hours", "sum"))
    ent = zd[zd["zone_id"] == "Z-ENT"].set_index("gaming_date")["entries_est"].rename("entrance_est")
    p = p.join(t, on="gaming_date").join(ent, on="gaming_date")
    p["events"] = events_by_day(p["gaming_date"]).to_numpy()
    p["is_event"] = p["events"].str.len() > 0
    return p


def event_uplift(d: pd.DataFrame) -> pd.DataFrame:
    """Each event's mean daily coin-in vs same-weekday non-event days within +-28 days (ratio of means), with a bootstrap 90% CI."""
    rng = np.random.default_rng(7)
    ev = table("events")
    rows = []
    base = d[~d["is_event"]]
    for e in ev.itertuples():
        on = d[(d["gaming_date"] >= e.start_date) & (d["gaming_date"] <= e.end_date)]
        if on.empty:
            continue
        wd = set(on["local_weekday"])
        near = base[(base["gaming_date"] - e.start_date).abs().dt.days.le(28) & base["local_weekday"].isin(wd)]
        # Compare like weekdays: weight the baseline to the event's weekday mix.
        mix = on["local_weekday"].value_counts(normalize=True)
        bmean = near.groupby("local_weekday")["coin_in_usd"].mean().reindex(mix.index)
        ratio = on["coin_in_usd"].mean() / float((bmean * mix).sum())
        boots = []
        for _ in range(500):
            s = near.sample(len(near), replace=True, random_state=int(rng.integers(1e9)))
            bm = s.groupby("local_weekday")["coin_in_usd"].mean().reindex(mix.index)
            if bm.isna().any():
                continue
            boots.append(
                on["coin_in_usd"].sample(len(on), replace=True, random_state=int(rng.integers(1e9))).mean()
                / float((bm * mix).sum())
            )
        lo, hi = np.quantile(boots, [0.05, 0.95])
        rows.append(
            {
                "event_id": e.event_id,
                "name": e.name,
                "event_type": e.event_type,
                "scope": e.local_scope,
                "start": e.start_date.date().isoformat(),
                "end": e.end_date.date().isoformat(),
                "days": len(on),
                "baseline_days": len(near),
                "uplift": ratio - 1,
                "uplift_lo": lo - 1,
                "uplift_hi": hi - 1,
            }
        )
    return pd.DataFrame(rows)


def zone_hour_profile(z: pd.DataFrame) -> pd.DataFrame:
    """Month x zone x local hour: mean entries per covered hour (masked hours excluded, not zeroed)."""
    z = z.assign(month=z["gaming_date"].dt.strftime("%Y-%m"))
    return z.groupby(["month", "zone_id", "local_hour"])["rate"].mean().rename("entries_per_hr").reset_index()


def walkway_closures() -> pd.DataFrame:
    w = table("floor_walkways")
    w = w[w["closed_from_utc"].notna()]
    return w[["walkway_id", "zone_a", "zone_b", "closed_from_utc", "closed_to_utc", "closure_reason"]]


def city_context() -> pd.DataFrame:
    return table("city_visitation")[
        ["month", "visitor_volume", "visitor_yoy_ratio", "convention_attendance", "hotel_occupancy_ratio", "source_url"]
    ]
