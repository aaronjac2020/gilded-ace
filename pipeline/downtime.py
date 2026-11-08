"""Downtime: unavailable hours and the play/theo they likely cost (an estimate with a range)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.load import sql


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


SHIFTS = (("day", 6, 14), ("swing", 14, 22), ("grave", 22, 6))


def shift_of(hour: pd.Series) -> pd.Series:
    """Local clock hour -> roster shift (day 06-14, swing 14-22, grave 22-06)."""
    return pd.Series(np.select([hour.between(6, 13), hour.between(14, 21)], ["day", "swing"], "grave"), index=hour.index)


def tickets(theo_per_avail_hr: pd.Series) -> pd.DataFrame:
    """Fault-repair tickets with wait-for-tech and total down hours, shift, bank/zone, and an estimated lost theo.

    Lost theo per ticket = down hours x the machine's full-period theo per available hour (an estimate: the
    machine-day loss model is the reference figure; this one only splits it by shift and ticket).
    """
    o = sql(
        """
        select o.operation_id, o.machine_id, o.location_id, l.bank_id, l.zone_id, o.opened_at_local,
               epoch(o.work_started_at_utc - o.opened_at_utc) / 3600 as wait_hours,
               epoch(o.available_at_utc - o.opened_at_utc) / 3600 as down_hours,
               o.direct_cost_cents / 100.0 as repair_cost_usd
        from {operations} o
        left join {floor_locations} l on l.location_id = o.location_id
        where o.event_type = 'fault_repair'
        order by o.opened_at_local
        """
    )
    o["gaming_date"] = (o["opened_at_local"] - pd.Timedelta(hours=6)).dt.normalize()
    o["shift"] = shift_of(o["opened_at_local"].dt.hour)
    o["lost_theo_usd"] = o["down_hours"] * o["machine_id"].map(theo_per_avail_hr).fillna(theo_per_avail_hr.median())
    return o


def staffing() -> pd.DataFrame:
    """Slot-tech headcount by shift: planned vs actual, mean per gaming day."""
    r = sql(
        "select shift, avg(planned_headcount) planned, avg(actual_headcount) actual from {shift_roster} where role = 'slot_tech' group by 1"
    )
    return r.set_index("shift").reindex([s for s, _, _ in SHIFTS]).reset_index()
