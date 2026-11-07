"""$100k, 30-day action plan: cost formula, rule validator, recommended plan with effect ranges.

Cost (USD) of n units of an action = n x (unit_cost + recurring_per_day x max(0, horizon - lead_days)).
Recurring costs only accrue once the action is live (e.g. a lease starts after its 14-day lead).
Effects are theo (house expected win) over the live days of the 30-day horizon, low/mid/high.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from pipeline.config import cfg
from pipeline.load import cents_to_usd, table


@dataclass
class Line:
    action_type_id: str
    quantity: int
    targets: list[str] = field(default_factory=list)
    effect_lo_usd: float = 0.0
    effect_mid_usd: float = 0.0
    effect_hi_usd: float = 0.0
    rationale: str = ""
    measurement: str = ""
    uncertainty: str = ""
    evidence: str = ""


def catalog() -> pd.DataFrame:
    """Action catalog with USD costs and the per-unit cost over the horizon."""
    a = table("action_catalog").copy()
    h = cfg()["budget"]["horizon_days"]
    a["unit_cost_usd"] = cents_to_usd(a["unit_cost_cents"])
    a["recurring_usd_per_day"] = cents_to_usd(a["recurring_cost_cents_per_day"])
    a["live_days"] = (h - a["lead_days"]).clip(lower=0)
    a["unit_total_usd"] = a["unit_cost_usd"] + a["recurring_usd_per_day"] * a["live_days"]
    return a.set_index("action_type_id")


def line_cost(action_type_id: str, quantity: int, cat: pd.DataFrame | None = None) -> float:
    cat = catalog() if cat is None else cat
    return float(quantity * cat.loc[action_type_id, "unit_total_usd"])


def validate(lines: list[Line], cat: pd.DataFrame | None = None) -> list[str]:
    """Rule violations (empty list = valid): budget cap, <= 3 action types, quantity limits,
    incompatibility groups (no two actions of the same group on the same target/policy)."""
    cat = catalog() if cat is None else cat
    b = cfg()["budget"]
    errs: list[str] = []
    active = [ln for ln in lines if ln.quantity > 0 and ln.action_type_id != "A-HOLD"]
    types = {ln.action_type_id for ln in active}
    if len(types) > b["max_action_types"]:
        errs.append(f"{len(types)} action types > {b['max_action_types']} allowed")
    total = sum(line_cost(ln.action_type_id, ln.quantity, cat) for ln in active)
    if total > b["total_usd"] + 1e-6:
        errs.append(f"total ${total:,.0f} exceeds ${b['total_usd']:,.0f}")
    for ln in active:
        lim = cat.loc[ln.action_type_id, "quantity_limit"]
        if ln.quantity > lim:
            errs.append(f"{ln.action_type_id}: quantity {ln.quantity} > limit {lim}")
        if ln.targets and len(ln.targets) != ln.quantity:
            errs.append(f"{ln.action_type_id}: {len(ln.targets)} targets for quantity {ln.quantity}")
    groups: dict[str, list[Line]] = {}
    for ln in active:
        g = cat.loc[ln.action_type_id, "incompatibility_group"]
        if isinstance(g, str):
            groups.setdefault(g, []).append(ln)
    for g, lns in groups.items():
        if len(lns) < 2:
            continue
        if g == "comp_policy":
            errs.append(f"incompatible: {', '.join(ln.action_type_id for ln in lns)} (one comp policy action)")
            continue
        seen: dict[str, str] = {}
        for ln in lns:
            for t in ln.targets:
                if t in seen and seen[t] != ln.action_type_id:
                    errs.append(f"incompatible on {t}: {seen[t]} + {ln.action_type_id}")
                seen[t] = ln.action_type_id
    return errs


def plan_total(lines: list[Line], cat: pd.DataFrame | None = None) -> float:
    cat = catalog() if cat is None else cat
    return sum(line_cost(ln.action_type_id, ln.quantity, cat) for ln in lines if ln.action_type_id != "A-HOLD")


def to_frame(lines: list[Line], cat: pd.DataFrame | None = None) -> pd.DataFrame:
    cat = catalog() if cat is None else cat
    rows = []
    for ln in lines:
        rows.append(
            {
                "action_type_id": ln.action_type_id,
                "name": cat.loc[ln.action_type_id, "name"],
                "quantity": ln.quantity,
                "targets": ", ".join(ln.targets),
                "cost_usd": line_cost(ln.action_type_id, ln.quantity, cat),
                "effect_lo_usd": ln.effect_lo_usd,
                "effect_mid_usd": ln.effect_mid_usd,
                "effect_hi_usd": ln.effect_hi_usd,
                "rationale": ln.rationale,
                "measurement": ln.measurement,
                "uncertainty": ln.uncertainty,
                "evidence": ln.evidence,
            }
        )
    return pd.DataFrame(rows)


def recommend(full: pd.DataFrame) -> list[Line]:
    """Recommended plan from the full-period scorecard (index machine_id). v0: fixed structure,
    targets + effect ranges from data; the optimizer + sensitivity replace this in M11."""
    from pipeline import verdicts

    cat = catalog()
    lines: list[Line] = []
    days = full["days_on_floor"].clip(lower=1)

    insp = full[full["hold_flag"].fillna(False)]
    if len(insp):
        live = cat.loc["A-INSPECT", "live_days"]
        gap = ((insp["hold_expected"] - insp["hold_obs"]).clip(lower=0) * insp["coin_in_usd"] / days * live).sum()
        lines.append(
            Line(
                "A-INSPECT",
                len(insp),
                list(insp.index),
                0.0,
                0.5 * gap,
                gap,
                rationale="Hold far below configured setting in both halves of the period (survives 10% FDR).",
                measurement="Technician verifies the paytable/config against game_math; then compare 30-day hold to configured.",
                uncertainty="Inspection is information: it may confirm a config difference or find nothing (low = $0).",
                evidence="/floor?machine=" + insp.index[0],
            )
        )

    ours, _ = verdicts.truly_weak_list(full)
    live = cat.loc["A-REPLACE-LEASE", "live_days"]
    per = (full.loc[ours.index, "theo_usd"] / days.loc[ours.index]) * (1 / ours["machine_effect_shrunk"] - 1) * live
    lines.append(
        Line(
            "A-REPLACE-LEASE",
            len(ours),
            list(ours.index),
            0.25 * per.sum(),
            0.5 * per.sum(),
            per.sum(),
            rationale="Lowest shrunk machine effect: draws less play than its spot and game predict, upper 90% bound < 1.",
            measurement="Compare coin-in/available hr of each replacement to its location expectation for 16 live days vs. the other bank machines.",
            uncertainty="Assumes a new title closes 25-100% of the gap to its location's expectation.",
            evidence="/?focus=ours",
        )
    )

    z = full[full["zone_id"] == "Z-B40"]
    live = cat.loc["A-WAYFINDING", "live_days"]
    base = z["theo_usd"].sum() / 181 * live
    lines.append(
        Line(
            "A-WAYFINDING",
            1,
            ["Z-B40"],
            0.02 * base,
            0.05 * base,
            0.10 * base,
            rationale="Z-B40 has the lowest coin-in/hr on the floor and fell further while walkway W-ENT-B40 was closed (Mar 3 - Apr 7).",
            measurement="Z-B40 share of floor coin-in and zone traffic, 20 live days vs. the prior 30 (difference-in-differences vs. Z-BAR).",
            uncertainty="Signage lift of 2-10% of zone theo is an assumption, not estimated from this data.",
            evidence="/demand?zone=Z-B40",
        )
    )
    return lines


def plan_summary(full: pd.DataFrame) -> dict:
    cat = catalog()
    lines = recommend(full)
    total = plan_total(lines, cat)
    return {
        "lines": to_frame(lines, cat),
        "total_usd": total,
        "kept_usd": cfg()["budget"]["total_usd"] - total,
        "errors": validate(lines, cat),
        "effect": {k: sum(getattr(ln, f"effect_{k}_usd") for ln in lines) for k in ("lo", "mid", "hi")},
    }
