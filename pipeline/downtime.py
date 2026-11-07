"""Downtime: unavailable hours and the play/theo they likely cost (an estimate with a range)."""

from __future__ import annotations

import numpy as np
import pandas as pd


def machine_day_losses(md: pd.DataFrame) -> pd.DataFrame:
    """Machine-day grain. Adds unavailable_hours and lost coin-in/theo (lo/mid/hi, USD).

    Rate = this machine's coin-in per available hour on the same weekday within md
    (ratio of sums); fallback = its zone's weekday rate. Range = 25th-75th percentile of the
    machine's own same-weekday daily rates (zone's when the machine has <3 such days).
    """
    d = md.copy()
    d["unavailable_hours"] = (d["scheduled_hours"] - d["available_hours"]).clip(lower=0)
    pos = d[d["available_hours"] > 0].assign(rate=lambda x: x["coin_in_usd"] / x["available_hours"])

    def agg(keys: list[str]) -> pd.DataFrame:
        g = pos.groupby(keys)
        return pd.DataFrame(
            {
                "mid": g["coin_in_usd"].sum() / g["available_hours"].sum(),
                "lo": g["rate"].quantile(0.25),
                "hi": g["rate"].quantile(0.75),
                "n": g.size(),
            }
        )

    m = agg(["machine_id", "local_weekday"])
    z = agg(["zone_id", "local_weekday"])
    d = d.join(m, on=["machine_id", "local_weekday"]).join(z.add_suffix("_z"), on=["zone_id", "local_weekday"])
    use_zone = d["mid"].isna() | (d["n"].fillna(0) < 3)
    rtp_margin = 1 - d["configured_rtp"]
    for k in ("lo", "mid", "hi"):
        rate = np.where(use_zone, d[f"{k}_z"], d[k])
        d[f"lost_coin_in_{k}_usd"] = d["unavailable_hours"] * rate
        d[f"lost_theo_{k}_usd"] = d[f"lost_coin_in_{k}_usd"] * rtp_margin
    return d.drop(columns=["lo", "mid", "hi", "n", "lo_z", "mid_z", "hi_z", "n_z"])
