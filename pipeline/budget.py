"""$100k, 30-day action plan: cost formula, rule validator, recommended plan with effect ranges.

Cost (USD) of n units of an action = n x (unit_cost + recurring_per_day x max(0, horizon - lead_days)).
Recurring costs only accrue once the action is live (e.g. a lease starts after its 14-day lead).
Effects are theo (house expected win) over the live days of the 30-day horizon, low/mid/high.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from scipy import stats

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


def move_test(full: pd.DataFrame, alt: dict, cat: pd.DataFrame | None = None, seed: int = 42) -> dict:
    """Controlled location test: swap N of our low-effect machines in busier spots with N of the manager's quiet-spot
    machines (on floor, not flagged weak or for inspection), each with a matched unmoved same-bank control, and
    re-estimate beta (does play follow the spot) on 2N planned moves. Returns the sizing table, chosen N, expected theo
    at the natural-experiment beta (lo/mid/hi) and the value of information for the follow-on replace decision."""
    from pipeline import verdicts

    cat = catalog() if cat is None else cat
    mt = cfg()["budget"]["move_test"]
    mv, noise = alt["moved"], alt["move_noise"]
    mv_cat = cat.loc["A-MOVE-MACHINE"]
    f = full[full["on_floor_end"].astype(bool)].copy()
    f["spot"] = f["location_expected_per_hr"]
    f["hold"] = f["theo_usd"] / f["coin_in_usd"]
    f["eh"] = f["machine_effect_shrunk"] * f["hold"]
    s_ref, hold_ref = float(f["spot"].median()), float(f["hold"].median())
    hrs = float((f["available_hours"] / f["days_on_floor"].clip(lower=1)).median())
    live, down_h = float(mv_cat["live_days"]), float(mv_cat["downtime_minutes"]) / 60

    ours = f[(f["verdict"] == "truly_weak") & (f["spot"] >= s_ref)].sort_values("eh").index
    mgr = [m for m in verdicts.manager_list(full).index if m in f.index]
    q = f.loc[mgr]
    quiet = q[~q["verdict"].isin(["truly_weak", "inspect_hold"])].sort_values("eh", ascending=False).index
    pairs = list(zip(ours, quiet, strict=False))[: int(mv_cat["quantity_limit"]) // 2]

    def rate(i: str, spot: float, b: float) -> float:  # theo per available hour when play scales with spot^beta
        return float(f.at[i, "eh"] * spot**b * s_ref ** (1 - b))

    def theo(P: list[tuple[str, str]], b: float) -> float:
        g = 0.0
        for w, m in P:
            sw, sm = f.at[w, "spot"], f.at[m, "spot"]
            g += rate(m, sw, b) + rate(w, sm, b) - rate(m, sm, b) - rate(w, sw, b)
        return g * hrs * live - sum(down_h * rate(i, f.at[i, "spot"], b) for p in P for i in p)

    ci = cfg()["bootstrap"]["ci"]
    # Planned interval by simulation: each move's noise is resampled from real treated-minus-control changes in
    # log(play / spot expectation) over the operating days after lead time, plus the new-vs-old spot's own model error
    # scaled by the prior beta. beta_hat - beta = sum(noise * ds) / sum(ds^2); width = central 90% of that spread.
    # Machine-to-machine variation in beta (tau): the noise alone predicts a narrower interval on the 4 observed moves
    # than their bootstrap gave; tau is set so the simulation reproduces the observed interval (model, and peers as a
    # sensitivity). Each move's error then gets tau * ds * N(0, 1).
    rng = np.random.default_rng(seed)
    e_pool, u_pool = np.asarray(noise["draws"]), np.asarray(noise["spot_draws"])
    z = stats.norm.ppf(ci / 2 + 0.5)
    sig2 = float(e_pool.var() + 2 * u_pool.var() * mv["beta_model"] ** 2)
    ds_obs = np.array([np.log(x["spot_after"] / x["spot_before"]) for x in mv["moves"]])
    s2, s4 = float((ds_obs**2).sum()), float((ds_obs**4).sum())

    def tau_for(hw_obs: float) -> float:
        return float(np.sqrt(max(0.0, ((hw_obs / z) ** 2 * s2**2 - sig2 * s2) / s4)))

    tau = tau_for((mv["beta_model_hi"] - mv["beta_model_lo"]) / 2)
    tau_peer = tau_for((mv["beta_peer_hi"] - mv["beta_peer_lo"]) / 2)

    def errs(ds: np.ndarray, t: float) -> dict[str, np.ndarray]:
        k = len(ds)
        e = rng.choice(e_pool, (mt["sims"], k))
        u = (rng.choice(u_pool, (mt["sims"], k)) - rng.choice(u_pool, (mt["sims"], k))) * mv["beta_model"]
        h = t * ds * rng.standard_normal((mt["sims"], k))
        return {k_: (x * ds).sum(1) / (ds**2).sum() for k_, x in (("noise", e), ("full", e + u + h))}

    def hw_of(x: np.ndarray) -> float:
        return float(np.diff(np.quantile(x, [0.5 - ci / 2, 0.5 + ci / 2]))[0] / 2)

    rows = []
    for n in range(1, len(pairs) + 1):
        P = pairs[:n]
        ds = np.repeat([np.log(f.at[m, "spot"] / f.at[w, "spot"]) for w, m in P], 2) * np.tile([-1, 1], n)
        err = errs(ds, tau)
        rows.append(
            {
                "swaps": n,
                "moves": 2 * n,
                "cost_usd": line_cost("A-MOVE-MACHINE", 2 * n, cat),
                "halfwidth_noise_only": hw_of(err["noise"]),
                "halfwidth": hw_of(err["full"]),
                "halfwidth_tau_peer": hw_of(errs(ds, tau_peer)["full"]),
                "se": float(err["full"].std()),
                **{f"theo_{k}_usd": theo(P, mv[f"beta_model{sfx}"]) for k, sfx in (("lo", "_lo"), ("mid", ""), ("hi", "_hi"))},
            }
        )
    ok = [r for r in rows if r["swaps"] >= mt["min_swaps"] and r["halfwidth"] <= mt["target_halfwidth"]]
    pick = ok[0] if ok else rows[-1]
    P = pairs[: pick["swaps"]]
    moved = [i for p in P for i in p]
    listed = set(moved) | set(mgr) | set(verdicts.truly_weak_list(full)[0].index)
    controls: dict[str, str] = {}
    for i in moved:  # same-bank, unlisted, unmoved; prefer verdict ok, nearest effect x hold
        pool = f[(f["bank_id"] == f.at[i, "bank_id"]) & ~f.index.isin(listed) & ~f.index.isin(list(controls.values()))]
        pool = pool[pool["verdict"] == "ok"] if (pool["verdict"] == "ok").any() else pool
        if len(pool):
            controls[i] = str((pool["eh"] - f.at[i, "eh"]).abs().idxmin())

    # Value of information for the follow-on decision: lease-replace each quiet-spot weak machine for followon_days.
    # Prior on beta: natural-experiment estimate, sd from the wider (model or peer) 90% interval.
    z = stats.norm.ppf(ci / 2 + 0.5)
    m0 = mv["beta_model"]
    s0 = max(mv["beta_model_hi"] - mv["beta_model_lo"], mv["beta_peer_hi"] - mv["beta_peer_lo"]) / (2 * z)
    se = pick["se"]
    lease = cat.loc["A-REPLACE-LEASE"]
    fo_live = max(0, mt["followon_days"] - int(lease["lead_days"]))
    fo_cost = float(lease["unit_cost_usd"] + lease["recurring_usd_per_day"] * fo_live)
    cand = f[(f["verdict"] == "truly_weak") & (f["spot"] < s_ref) & ~f.index.isin(moved)]
    sp, r_old = cand["spot"].to_numpy()[None, :], (cand["eh"] * cand["spot"]).to_numpy()[None, :]

    def v(beta: np.ndarray) -> np.ndarray:  # (len(beta), n_cand) follow-on theo minus lease cost of replacing each
        b = beta[:, None]
        return (mt["new_title_effect"] * hold_ref * sp**b * s_ref ** (1 - b) - r_old) * hrs * fo_live - fo_cost

    beta = rng.normal(m0, s0, mt["sims"])
    without = float(np.maximum(v(beta).mean(0), 0).sum())
    bhat = beta + rng.normal(0, se, len(beta))
    w = 1 / s0**2 + 1 / se**2
    pm, ps = (m0 / s0**2 + bhat / se**2) / w, np.sqrt(1 / w)
    grid = stats.norm.ppf(np.linspace(0.01, 0.99, 49))
    post_v = np.stack([v(pm + ps * g) for g in grid]).mean(0)  # (sims, n_cand) posterior expected value
    with_info = float((v(beta) * (post_v > 0)).sum(1).mean())
    return {
        "pairs": [
            {"ours": a, "manager": b, "spot_ours": float(f.at[a, "spot"]), "spot_manager": float(f.at[b, "spot"])} for a, b in P
        ],
        "controls": controls,
        "sizing": rows,
        "pick": pick,
        "voi_usd": max(0.0, with_info - without),
        "power": {
            "post_days": noise["post_days"],
            "noise_sd": noise["sd"],
            "spot_sd": noise["sd_spot"],
            "tau": tau,
            "tau_peer": tau_peer,
            "observed_design_halfwidth_noise_only": hw_of(errs(ds_obs, 0.0)["full"]),
        },
        "prior_beta": {"mean": float(m0), "sd": float(s0)},
        "posterior_sd": float(ps),
        "followon": {
            "days": mt["followon_days"],
            "cost_per_machine_usd": fo_cost,
            "candidates": list(cand.index),
            "value_at_prior_mean_usd": float(v(np.array([m0])).sum()),
            "value_at_beta0_usd": float(v(np.array([0.0])).sum()),
        },
    }


def recommend(full: pd.DataFrame, alt: dict | None = None) -> list[Line]:
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
    if alt:
        lines, _ = with_move_test(lines, move_test(full, alt, cat), cat)
    return lines


def line_value(ln: Line, voi: float = 0.0) -> float:
    """Ranking value when swapping actions under the type cap: expected (mid) theo + value of information.
    Only the move test is credited with VOI; other lines' information value is counted as $0."""
    return ln.effect_mid_usd + voi


def move_line(mt: dict) -> Line:
    p = mt["pick"]
    targets = [x for pr in mt["pairs"] for x in (pr["ours"], pr["manager"])]
    return Line(
        "A-MOVE-MACHINE",
        p["moves"],
        targets,
        p["theo_lo_usd"],
        p["theo_mid_usd"],
        p["theo_hi_usd"],
        rationale=(
            f"Controlled location test: swap {p['swaps']} of our low-effect machines in busier spots with {p['swaps']} of the "
            "manager's quiet-spot machines. Settles whether play follows the spot before paying to replace machines in quiet spots."
        ),
        measurement=(
            f"Pooled slope of log play change on log spot change over {p['moves']} moves, each against a matched unmoved machine "
            f"in the same bank, over the first {mt['power']['post_days']} operating days after the move. Planned 90% CI on the slope about +/-{p['halfwidth']:.2f}."
        ),
        uncertainty=(
            "Theo range uses the natural-experiment slope and its 90% CI. The manager's quiet-spot machines are low hold, "
            "so a swap gains less theo than play."
        ),
        evidence="/model?focus=ranking-compare",
    )


def with_move_test(lines: list[Line], mt: dict, cat: pd.DataFrame) -> tuple[list[Line], dict]:
    """Add the move test only if it fits the action-type cap and beats the lowest-value line on theo + VOI."""
    mvl = move_line(mt)
    paid = [ln for ln in lines if ln.action_type_id != "A-HOLD"]
    low = min(paid, key=line_value)
    full_cap = len({ln.action_type_id for ln in paid}) >= cfg()["budget"]["max_action_types"]
    cand = [ln for ln in paid if not (full_cap and ln is low)] + [mvl]
    cmp = {
        "move_test": {
            "cost_usd": line_cost(mvl.action_type_id, mvl.quantity, cat),
            "theo_mid_usd": mvl.effect_mid_usd,
            "voi_usd": mt["voi_usd"],
            "value_usd": line_value(mvl, mt["voi_usd"]),
        },
        "lowest": {
            "action_type_id": low.action_type_id,
            "cost_usd": line_cost(low.action_type_id, low.quantity, cat),
            "theo_mid_usd": low.effect_mid_usd,
            "voi_usd": 0.0,
            "value_usd": line_value(low),
        },
        "replaces": low.action_type_id if full_cap else None,
        "errors": validate(cand, cat),
    }
    cmp["included"] = bool(not cmp["errors"] and cmp["move_test"]["value_usd"] > cmp["lowest"]["value_usd"])
    return (cand if cmp["included"] else lines), cmp


def plan_summary(full: pd.DataFrame, alt: dict | None = None) -> dict:
    cat = catalog()
    lines = recommend(full, alt)
    total = plan_total(lines, cat)
    return {
        "lines": to_frame(lines, cat),
        "total_usd": total,
        "kept_usd": cfg()["budget"]["total_usd"] - total,
        "errors": validate(lines, cat),
        "effect": {k: sum(getattr(ln, f"effect_{k}_usd") for ln in lines) for k in ("lo", "mid", "hi")},
    }
