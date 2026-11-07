"""Ordered verdict rules and the 'truly weak 10' selection. First matching rule wins."""

from __future__ import annotations

import pandas as pd

from pipeline.config import cfg

ORDER = ["inspect_hold", "downtime", "location", "luck", "truly_weak", "ok"]
LABELS = {
    "inspect_hold": "Inspect hold",
    "downtime": "Downtime",
    "location": "Location",
    "luck": "Luck",
    "truly_weak": "Truly weak",
    "ok": "OK",
}


def _pct(x: float) -> str:
    return f"{x:.1%}"


def assign_verdicts(sc: pd.DataFrame) -> pd.DataFrame:
    """Add verdict + verdict_reason to a machine-grain scorecard (index machine_id).

    Rules (config.yaml 'verdicts'), applied in ORDER:
      inspect_hold: hold-gap BH-FDR flag with the same sign in both halves of the period.
      downtime: availability in bottom decile AND lost theo >= 50% of gap to zone median theo/scheduled hr.
      location: shrunk effect 90% CI includes 1 AND location-expected coin-in/hr in bottom quartile.
      luck: |luck_z| >= 1.64 with negative residual AND theo/available hr not in bottom decile.
      truly_weak: shrunk effect upper 90% bound < 1.
    """
    v = cfg()["verdicts"]
    sc = sc.copy()
    avail_cut = sc["availability"].quantile(v["downtime_avail_quantile"])
    loc_cut = sc["location_expected_per_hr"].quantile(v["location_quantile"])
    theo_cut = sc["theo_per_avail_hr"].quantile(v["theo_hr_low_quantile"])
    zone_med = sc.groupby("zone_id")["theo_per_sched_hr"].transform("median")
    gap = (zone_med * sc["scheduled_hours"] - sc["theo_usd"]).clip(lower=0)
    sc["gap_to_zone_median_theo_usd"] = gap

    rules = {
        "inspect_hold": sc["hold_flag"].fillna(False),
        "downtime": (sc["availability"] <= avail_cut) & (gap > 0) & (sc["lost_theo_usd"] >= v["downtime_gap_share"] * gap),
        "location": (sc["effect_shrunk_lo"] <= 1) & (sc["effect_shrunk_hi"] >= 1) & (sc["location_expected_per_hr"] <= loc_cut),
        "luck": (sc["luck_z"].abs() >= v["luck_z"]) & (sc["luck_resid_usd"] < 0) & (sc["theo_per_avail_hr"] > theo_cut),
        "truly_weak": sc["effect_shrunk_hi"] < 1,
    }
    verdict = pd.Series("ok", index=sc.index)
    for name in reversed(ORDER[:-1]):
        verdict = verdict.mask(rules[name].fillna(False), name)
    sc["verdict"] = verdict
    sc["verdict_reason"] = [_reason(r, verdict.loc[i], gap.loc[i], loc_cut) for i, r in sc.iterrows()]
    return sc


def _reason(r: pd.Series, verdict: str, gap: float, loc_cut: float) -> str:
    exposure = f" On floor only {int(r.days_on_floor)} days." if r.days_on_floor < 120 else ""
    if r.hold_expected <= cfg()["verdicts"]["low_hold_design"]:
        exposure += f" Configured hold is {_pct(r.hold_expected)}, so low win is partly by design."
    if verdict == "inspect_hold":
        return (
            f"Observed hold {_pct(r.hold_obs)} vs configured {_pct(r.hold_expected)} "
            f"(z={r.hold_gap_z:.1f}, same direction in both halves, survives 10% FDR). Inspect and verify the paytable."
        ) + exposure
    if verdict == "downtime":
        return (
            f"Available {_pct(r.availability)} of scheduled time; est. lost theo ${r.lost_theo_usd:,.0f} "
            f"covers {r.lost_theo_usd / gap:.0%} of its ${gap:,.0f} gap to the zone median."
        ) + exposure
    if verdict == "location":
        return (
            f"Plays as its spot predicts (effect {r.machine_effect_shrunk:.2f}, 90% CI {r.effect_shrunk_lo:.2f}-{r.effect_shrunk_hi:.2f}); "
            f"its location expects ${r.location_expected_per_hr:,.0f}/hr, bottom quarter of the floor."
        ) + exposure
    if verdict == "luck":
        return (
            f"House win ${r.luck_resid_usd:,.0f} below theo (luck z={r.luck_z:.1f}, {r.volatility_class} volatility); "
            f"theo/hr ${r.theo_per_avail_hr:,.0f} is normal. Expected to revert."
        ) + exposure
    if verdict == "truly_weak":
        return (
            f"Draws {1 - r.machine_effect_shrunk:.0%} less play than its location and game predict "
            f"(shrunk effect {r.machine_effect_shrunk:.2f}, upper 90% bound {r.effect_shrunk_hi:.2f} < 1)."
        ) + exposure
    return (
        f"Effect {r.machine_effect_shrunk:.2f} (90% CI {r.effect_shrunk_lo:.2f}-{r.effect_shrunk_hi:.2f}), "
        f"availability {_pct(r.availability)}, luck z={r.luck_z:.1f}: no rule fired."
    ) + exposure


def manager_list(sc: pd.DataFrame) -> pd.DataFrame:
    """The GM's rule: lowest total house win over the period (on-floor days only)."""
    return sc.nsmallest(cfg()["verdicts"]["list_size"], "house_win_usd")


def truly_weak_list(sc: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Our 10: lowest shrunk effect among truly_weak machines (topped up with lowest-effect 'ok').

    Eligible: >= min_days_on_floor and on the floor on the period's last day (retired machines
    can't be replaced). Returns (list, excluded-for-eligibility truly_weak machines).
    """
    v = cfg()["verdicts"]
    elig = (sc["days_on_floor"] >= v["min_days_on_floor"]) & sc["on_floor_end"]
    tw = sc[(sc["verdict"] == "truly_weak") & elig].sort_values("machine_effect_shrunk")
    pick = tw.head(v["list_size"])
    if len(pick) < v["list_size"]:
        ok = sc[(sc["verdict"] == "ok") & elig].sort_values("machine_effect_shrunk")
        pick = pd.concat([pick, ok.head(v["list_size"] - len(pick))])
    excluded = sc[(sc["verdict"] == "truly_weak") & ~elig]
    return pick, excluded


def verdict_counts(sc: pd.DataFrame) -> pd.Series:
    return sc["verdict"].value_counts().reindex(ORDER, fill_value=0)
