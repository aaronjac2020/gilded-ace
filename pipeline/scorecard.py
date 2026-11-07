"""Machine scorecard for any date range: exposure, availability, luck, hold gap, location effect, verdict."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd

from pipeline import downtime, holdgap, luck, shrinkage, verdicts
from pipeline.config import cfg, periods
from pipeline.load import filter_dates, machine_days

FROZEN_COLUMNS = [
    "machine_id",
    "period",
    "days_on_floor",
    "availability",
    "coin_in_per_avail_hr",
    "theo_usd",
    "house_win_usd",
    "luck_resid_usd",
    "luck_z",
    "hold_obs",
    "hold_expected",
    "hold_ci_lo",
    "hold_ci_hi",
    "location_expected_per_hr",
    "machine_effect",
    "machine_effect_shrunk",
    "verdict",
    "verdict_reason",
]


def period_name(start: date, end: date) -> str:
    for k, (a, b) in periods().items():
        if (a, b) == (start, end):
            return k
    return f"{start}_{end}"


def zone_weekday_rate(md: pd.DataFrame) -> pd.Series:
    """Baseline expectation: zone x weekday coin-in per available hour (ratio of sums), per machine-day."""
    g = md.groupby(["zone_id", "local_weekday"])[["coin_in_usd", "available_hours"]].sum()
    rate = (g["coin_in_usd"] / g["available_hours"].where(g["available_hours"] > 0)).rename("rate")
    return md.join(rate, on=["zone_id", "local_weekday"])["rate"]


def expected_rate(md: pd.DataFrame) -> pd.Series:
    """Location + game expected coin-in per available hour for each machine-day.

    config location_expectation: 'zone_weekday' (provisional) or 'model' (Model 1, no machine_id feature).
    """
    if cfg().get("location_expectation", "zone_weekday") == "model":
        from pipeline.model_machine import expected_rate_model

        return expected_rate_model(md)
    return zone_weekday_rate(md)


def prepare_days(start: date, end: date) -> pd.DataFrame:
    """On-floor machine-days in [start, end] with variance, luck and location expectation columns."""
    md = filter_dates(machine_days(), start, end).copy()
    md = luck.add_daily_variance(md)
    md["luck_usd"] = md["house_win_usd"] - md["theo_usd"]
    md["loc_rate"] = expected_rate(md).to_numpy()
    md["loc_expected_coin_in_usd"] = md["loc_rate"] * md["available_hours"]
    return downtime.machine_day_losses(md)


def build_scorecard(start: date, end: date) -> pd.DataFrame:
    """Machine grain for [start, end] (gaming dates, inclusive). Money in USD, rates per available hour.

    Ratio of sums everywhere. Off-floor days are excluded, so exposure = days/hours on the floor.
    """
    md = prepare_days(start, end)
    last = md.sort_values("gaming_date").groupby("machine_id").tail(1).set_index("machine_id")
    g = md.groupby("machine_id")
    sc = pd.DataFrame(
        {
            "days_on_floor": g.size(),
            "scheduled_hours": g["scheduled_hours"].sum(),
            "available_hours": g["available_hours"].sum(),
            "unavailable_hours": g["unavailable_hours"].sum(),
            "coin_in_usd": g["coin_in_usd"].sum(),
            "carded_coin_in_usd": g["carded_coin_in_usd"].sum(),
            "theo_usd": g["theo_usd"].sum(),
            "house_win_usd": g["house_win_usd"].sum(),
            "var_win_usd2": g["var_win_usd2"].sum(),
            "loc_expected_coin_in_usd": g["loc_expected_coin_in_usd"].sum(),
            "lost_coin_in_usd": g["lost_coin_in_mid_usd"].sum(),
            "lost_theo_lo_usd": g["lost_theo_lo_usd"].sum(),
            "lost_theo_usd": g["lost_theo_mid_usd"].sum(),
            "lost_theo_hi_usd": g["lost_theo_hi_usd"].sum(),
            "faults": g["faults_opened"].sum(),
        }
    )
    sc = sc.join(
        last[["zone_id", "zone_name", "bank_id", "location_id", "config_id", "theme", "manufacturer", "volatility_class"]]
    )
    sc["configured_rtp"] = last["configured_rtp"]
    sc["on_floor_end"] = last["gaming_date"] == pd.Timestamp(end)
    avail = sc["available_hours"].where(sc["available_hours"] > 0)
    sc["availability"] = sc["available_hours"] / sc["scheduled_hours"]
    sc["coin_in_per_avail_hr"] = sc["coin_in_usd"] / avail
    sc["theo_per_avail_hr"] = sc["theo_usd"] / avail
    sc["theo_per_sched_hr"] = sc["theo_usd"] / sc["scheduled_hours"]
    sc["carded_share"] = sc["carded_coin_in_usd"] / sc["coin_in_usd"].where(sc["coin_in_usd"] > 0)
    sc["luck_resid_usd"] = sc["house_win_usd"] - sc["theo_usd"]
    sc["sd_win_usd"] = np.sqrt(sc["var_win_usd2"])
    sc["luck_z"] = sc["luck_resid_usd"] / sc["sd_win_usd"].where(sc["sd_win_usd"] > 0)
    sc["location_expected_per_hr"] = sc["loc_expected_coin_in_usd"] / avail
    sc["machine_effect"] = sc["coin_in_usd"] / sc["loc_expected_coin_in_usd"].where(sc["loc_expected_coin_in_usd"] > 0)

    hg = holdgap.hold_gap_test(md).set_index("machine_id")
    sc = sc.join(hg.drop(columns=["hold_obs", "hold_expected"])).join(hg[["hold_obs", "hold_expected"]])
    cm = holdgap.config_mismatch(md).set_index("machine_id")
    sc = sc.join(cm[["best_fit_config", "z_best", "avg_bet_usd", "bet_in_range", "mismatch_lead", "config_changed"]])

    boot = luck.bootstrap_cis(md).set_index("machine_id")
    sc = sc.join(boot)
    eb = shrinkage.shrink_effect(sc["machine_effect"], sc["effect_boot_se"])
    sc = sc.join(eb)

    sc = verdicts.assign_verdicts(sc)
    sc.insert(0, "period", period_name(start, end))
    sc = sc.reset_index().rename(columns={"index": "machine_id"})
    sc = sc.rename(columns={"luck_ci_lo": "luck_resid_ci_lo", "luck_ci_hi": "luck_resid_ci_hi"})
    rest = [c for c in sc.columns if c not in FROZEN_COLUMNS]
    return sc[FROZEN_COLUMNS + rest]
