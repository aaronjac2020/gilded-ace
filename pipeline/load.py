"""Typed loaders. The only place cents become dollars and timestamps become gaming dates."""

from __future__ import annotations

from datetime import date
from functools import cache, lru_cache

import duckdb
import numpy as np
import pandas as pd

from pipeline.config import data_path

GAMING_DAY_START_HOUR = 6

T = {
    "pdv": "1_prepared_views/prepared_daily_view",
    "property_day": "1_prepared_views/property_day",
    "player_period": "1_prepared_views/player_period",
    "machines": "2_machine_decision/machines",
    "game_math": "2_machine_decision/game_math",
    "placements": "2_machine_decision/placements",
    "floor_locations": "2_machine_decision/floor_locations",
    "floor_walkways": "2_machine_decision/floor_walkways",
    "machine_day": "2_machine_decision/machine_day",
    "operations": "2_machine_decision/operations",
    "cost_rules": "2_machine_decision/cost_rules",
    "action_catalog": "2_machine_decision/action_catalog",
    "calendar_day": "2_machine_decision/calendar_day",
    "players": "3_guests/players",
    "sessions": "3_guests/sessions",
    "trips": "3_guests/trips",
    "loyalty_ledger": "3_guests/loyalty_ledger",
    "fnb": "3_guests/fnb_transactions",
    "zone_traffic": "4_context/zone_traffic_hourly",
    "events": "4_context/events",
    "city_visitation": "4_context/real_sources/city_visitation_monthly",
    "weather": "4_context/real_sources/weather_daily",
    "benchmark_state": "4_context/real_sources/benchmark_state_monthly",
    "shift_roster": "5_optional/shift_roster",
    "security_incidents": "5_optional/security_incidents",
}


def path(key: str) -> str:
    return data_path(T[key]).as_posix()


def sql(query: str) -> pd.DataFrame:
    """Run DuckDB SQL; reference tables as {key}, e.g. 'select * from {pdv}'."""
    q = query.format(**{k: f"read_parquet('{path(k)}')" for k in T})
    return duckdb.sql(q).df()


def cents_to_usd(x: pd.Series | np.ndarray | float) -> pd.Series | np.ndarray | float:
    """Integer cents -> float dollars. The single conversion point."""
    if isinstance(x, pd.Series):
        return x.astype("float64") / 100.0
    return np.asarray(x, dtype="float64") / 100.0 if not np.isscalar(x) else float(x) / 100.0


def to_gaming_date(ts_local: pd.Series) -> pd.Series:
    """Local timestamp -> gaming date (06:00-06:00 local). 02:00 Sat belongs to Fri."""
    ts = pd.to_datetime(ts_local)
    return (ts - pd.Timedelta(hours=GAMING_DAY_START_HOUR)).dt.normalize()


@cache
def table(key: str) -> pd.DataFrame:
    """Whole table (DuckDB returns DECIMAL as float64), dates as datetime64. Cached; treat as read-only."""
    df = duckdb.sql(f"select * from read_parquet('{path(key)}')").df()
    for c in (
        "gaming_date",
        "start_date",
        "end_date",
        "announced_date",
        "install_date",
        "retire_date",
        "source_date",
    ):
        if c in df.columns:
            df[c] = pd.to_datetime(df[c])
    return df


def calendar() -> pd.DataFrame:
    """Gaming day grain. scheduled_hours = scheduled_seconds / 3600 (23 on 2025-03-08)."""
    c = table("calendar_day").copy()
    c["scheduled_hours"] = c["scheduled_seconds"] / 3600.0
    return c


@lru_cache(maxsize=1)
def machine_days() -> pd.DataFrame:
    """Machine x gaming day, on-floor rows only (location_id not null).

    Money in USD (prepared view) plus raw machine_day fields needed for luck:
    sum_bet_squared (cents^2), paid_spins, carded meters converted to USD.
    scheduled_hours comes from machine_day.scheduled_seconds (seconds on floor that day).
    """
    df = sql(
        """
        select d.machine_id, d.gaming_date, d.month, d.local_weekday, d.is_weekend,
               d.federal_holiday, d.events_active, d.zone_id, d.zone_name, d.bank_id,
               d.location_id, d.config_id, d.theme, d.configured_rtp::double as configured_rtp,
               d.volatility_class, d.manufacturer, d.lease_class,
               d.available_hours, d.occupied_hours, d.paid_spins,
               d.coin_in_usd::double as coin_in_usd, d.payout_usd::double as payout_usd,
               d.house_win_usd::double as house_win_usd, d.theo_usd::double as theo_usd,
               d.carded_coin_in_usd::double as carded_coin_in_usd, d.faults_opened,
               d.repair_cost_usd::double as repair_cost_usd,
               d.lag_coin_in_7d_mean_usd, d.lag_downtime_7d_hours, d.lag_house_win_28d_usd,
               m.scheduled_seconds, m.sum_bet_squared, m.carded_payout_cents, m.carded_theo_cents::double as carded_theo_cents,
               c.scheduled_seconds as day_scheduled_seconds
        from {pdv} d
        join {machine_day} m using (machine_id, gaming_date)
        join {calendar_day} c using (gaming_date)
        where d.location_id is not null
        """
    )
    df["gaming_date"] = pd.to_datetime(df["gaming_date"])
    df["scheduled_hours"] = df["scheduled_seconds"] / 3600.0
    df["day_scheduled_hours"] = df["day_scheduled_seconds"] / 3600.0
    df["carded_payout_usd"] = cents_to_usd(df["carded_payout_cents"])
    df["carded_theo_usd"] = cents_to_usd(df["carded_theo_cents"])
    df = df.drop(columns=["carded_payout_cents", "carded_theo_cents"])
    return df


def filter_dates(df: pd.DataFrame, start: date, end: date, col: str = "gaming_date") -> pd.DataFrame:
    return df[(df[col] >= pd.Timestamp(start)) & (df[col] <= pd.Timestamp(end))]


def ratio(num: pd.Series | float, den: pd.Series | float) -> pd.Series | float:
    """Ratio of sums helper: callers pass sums; zero denominators -> NaN."""
    if isinstance(den, pd.Series):
        return num / den.where(den != 0)
    return float(num) / den if den else float("nan")
