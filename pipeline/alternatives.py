"""Competing explanations: moved-machine natural experiment, carded share, volatility mix."""

from __future__ import annotations

from datetime import date

import numpy as np
import pandas as pd
from scipy import stats

from pipeline.config import cfg

HIGH_VOL = ("high", "very_high")


def _q() -> float:
    return (1 - cfg()["bootstrap"]["ci"]) / 2


def placements(md: pd.DataFrame) -> pd.DataFrame:
    """Consecutive placement segments per machine with on-floor day count and dates."""
    d = md.sort_values(["machine_id", "gaming_date"])
    seg = (d["location_id"] != d.groupby("machine_id")["location_id"].shift()).cumsum()
    return (
        d.assign(seg=seg)
        .groupby(["machine_id", "seg"])
        .agg(
            location_id=("location_id", "first"),
            zone_id=("zone_id", "first"),
            bank_id=("bank_id", "first"),
            first=("gaming_date", "min"),
            last=("gaming_date", "max"),
            days=("gaming_date", "size"),
        )
        .reset_index()
    )


def peer_rate(md: pd.DataFrame) -> pd.Series:
    """Coin-in per available hour of the other machines in the same bank on the same day (spot proxy without the model)."""
    keys = [md["bank_id"], md["gaming_date"]]
    c = md["coin_in_usd"].groupby(keys).transform("sum") - md["coin_in_usd"]
    h = md["available_hours"].groupby(keys).transform("sum") - md["available_hours"]
    return (c / h.where(h > 0)).fillna(0.0)


def _block_sums(day: pd.DataFrame, cols: list[str], block: int) -> np.ndarray:
    """Per 7-day block sums of cols, shape (n_blocks, len(cols)), for block-bootstrap resampling."""
    b = np.arange(len(day)) // block
    return day[cols].groupby(b).sum().to_numpy()


def moved_experiment(md: pd.DataFrame, seed: int = 42) -> dict:
    """Does a moved machine's play follow its new spot or stay with the machine?

    For each consecutive pair of placements with >= min days each:
      da = log(coin-in per avail hr after / before)        (what the machine did)
      ds = log(spot-expected rate after / before)          (what the spot predicts)
    Pooled slope beta = sum(da*ds) / sum(ds^2): 1 = play follows the spot, 0 = play stays with the machine.
    90% CI: bootstrap over moves, and 7-day blocks within each placement. Spot expectation from Model 1 (out-of-fold,
    no machine identity) and, as a model-free check, the other machines in the same bank on the same days.
    """
    n_min = cfg()["moved"]["min_days_each_placement"]
    block = cfg()["bootstrap"]["block_days"]
    reps = cfg()["bootstrap"]["resamples"]
    md = md.sort_values(["machine_id", "gaming_date"]).copy()
    md["peer_rate"] = peer_rate(md)
    md["peer_exp"] = md["peer_rate"] * md["available_hours"]
    cols = ["coin_in_usd", "available_hours", "loc_expected_coin_in_usd", "peer_exp"]
    seg = placements(md)
    moves, blocks = [], []
    for mid, s in seg.groupby("machine_id"):
        s = s.reset_index(drop=True)
        for i in range(1, len(s)):
            a, b = s.iloc[i - 1], s.iloc[i]
            if min(a.days, b.days) < n_min:
                continue
            m = md[md.machine_id == mid]
            da_, db_ = (m[(m.gaming_date >= x["first"]) & (m.gaming_date <= x["last"])] for x in (a, b))
            sa, sb = da_[cols].sum(), db_[cols].sum()
            r = lambda t, col: t[col] / t["available_hours"]  # noqa: E731
            moves.append(
                {
                    "machine_id": mid,
                    "from_location": a.location_id,
                    "to_location": b.location_id,
                    "from_zone": a.zone_id,
                    "to_zone": b.zone_id,
                    "moved_on": str(pd.Timestamp(b["first"]).date()),
                    "days_before": int(a.days),
                    "days_after": int(b.days),
                    "rate_before": float(r(sa, "coin_in_usd")),
                    "rate_after": float(r(sb, "coin_in_usd")),
                    "spot_before": float(r(sa, "loc_expected_coin_in_usd")),
                    "spot_after": float(r(sb, "loc_expected_coin_in_usd")),
                    "peer_before": float(r(sa, "peer_exp")),
                    "peer_after": float(r(sb, "peer_exp")),
                    "effect_before": float(sa["coin_in_usd"] / sa["loc_expected_coin_in_usd"]),
                    "effect_after": float(sb["coin_in_usd"] / sb["loc_expected_coin_in_usd"]),
                }
            )
            blocks.append((_block_sums(da_, cols, block), _block_sums(db_, cols, block)))
    n = len(moves)
    out: dict = {"n_moves": n, "n_machines": len({m["machine_id"] for m in moves}), "min_days": n_min, "moves": moves}
    if n == 0:
        return out

    def beta(A: np.ndarray, B: np.ndarray, j: int) -> float:
        # A, B: (n, 4) summed columns before/after; j = index of spot expectation column
        da = np.log((B[:, 0] / B[:, 1]) / (A[:, 0] / A[:, 1]))
        ds = np.log((B[:, j] / B[:, 1]) / (A[:, j] / A[:, 1]))
        return float((da * ds).sum() / (ds**2).sum())

    A = np.array([a.sum(0) for a, _ in blocks])
    B = np.array([b.sum(0) for _, b in blocks])
    rng = np.random.default_rng(seed)
    boot = {2: np.empty(reps), 3: np.empty(reps)}
    for k in range(reps):
        pick = rng.integers(0, n, n)
        Ab = np.array([blocks[i][0][rng.integers(0, len(blocks[i][0]), len(blocks[i][0]))].sum(0) for i in pick])
        Bb = np.array([blocks[i][1][rng.integers(0, len(blocks[i][1]), len(blocks[i][1]))].sum(0) for i in pick])
        for j in boot:
            boot[j][k] = beta(Ab, Bb, j)
    q = _q()
    for name, j in (("model", 2), ("peer", 3)):
        lo, hi = np.nanquantile(boot[j], [q, 1 - q])
        out[f"beta_{name}"] = beta(A, B, j)
        out[f"beta_{name}_lo"], out[f"beta_{name}_hi"] = float(lo), float(hi)
    # Decision rule: both 90% CIs above 0.5 = follows the spot; both below 0.5 = stays with the machine; otherwise
    # inconclusive. rejects_machine_only: both CIs exclude 0.
    lo = min(out["beta_model_lo"], out["beta_peer_lo"])
    hi = max(out["beta_model_hi"], out["beta_peer_hi"])
    out["follows_spot"] = bool(lo > 0.5)
    out["decision"] = "follows_spot" if lo > 0.5 else "stays_with_machine" if hi < 0.5 else "inconclusive"
    out["rejects_machine_only"] = bool(lo > 0)
    out["leave_one_out"] = {
        m["machine_id"]: {
            name: _slope([x for x in moves if x is not m], key) for name, key in (("model", "spot"), ("peer", "peer"))
        }
        for m in moves
    }
    return out


def _slope(moves: list[dict], key: str) -> float:
    da = np.array([np.log(m["rate_after"] / m["rate_before"]) for m in moves])
    ds = np.array([np.log(m[f"{key}_after"] / m[f"{key}_before"]) for m in moves])
    return float((da * ds).sum() / (ds**2).sum())


def residual_sd(md: pd.DataFrame, window: int = 28, step: int = 14) -> dict:
    """Noise for sizing a planned move test: sd over unmoved machines of the change in log(actual / spot expectation)
    between adjacent `window`-day windows, alone and as a difference vs. another unmoved machine in the same bank."""
    mv = md.groupby("machine_id")["location_id"].nunique()
    md = md[md.machine_id.isin(mv[mv == 1].index)]
    dates = np.sort(md.gaming_date.unique())
    agg = {"c": ("coin_in_usd", "sum"), "e": ("loc_expected_coin_in_usd", "sum"), "n": ("coin_in_usd", "size")}
    single, paired = [], []
    for st in range(0, len(dates) - 2 * window + 1, step):
        w = [
            md[md.gaming_date.isin(dates[st + k * window : st + (k + 1) * window])].groupby("machine_id").agg(**agg)
            for k in (0, 1)
        ]
        j = w[0].join(w[1], how="inner", lsuffix="1", rsuffix="2")
        j = j[(j.n1 >= 0.75 * window) & (j.n2 >= 0.75 * window)]
        r = np.log(j.c2 / j.e2) - np.log(j.c1 / j.e1)
        single += list(r)
        bank = md.drop_duplicates("machine_id").set_index("machine_id")["bank_id"].reindex(r.index)
        for _, v in r.groupby(bank):
            paired += list(v.to_numpy()[:-1] - v.to_numpy()[1:])
    return {"window_days": window, "sd": float(np.std(single)), "sd_vs_control": float(np.std(paired)), "n": len(single)}


def carded_share(full: pd.DataFrame, mgr_ids: list[str], seed: int = 42) -> dict:
    """Coin-in-weighted carded share for flagged groups vs. the floor, with bootstrap CI on the difference."""
    reps = cfg()["bootstrap"]["resamples"]
    rng = np.random.default_rng(seed)
    q = _q()
    f = full.reset_index()
    groups = {
        "manager_10": f.machine_id.isin(mgr_ids),
        "truly_weak": f.verdict.eq("truly_weak"),
        "not_ok": f.verdict.ne("ok"),
    }

    def share(d: pd.DataFrame) -> float:
        return float(d.carded_coin_in_usd.sum() / d.coin_in_usd.sum())

    out = {"floor": share(f), "groups": {}}
    for g, mask in groups.items():
        a, b = f[mask], f[~mask]
        d = np.empty(reps)
        for k in range(reps):
            d[k] = share(a.iloc[rng.integers(0, len(a), len(a))]) - share(b.iloc[rng.integers(0, len(b), len(b))])
        lo, hi = np.quantile(d, [q, 1 - q])
        out["groups"][g] = {
            "n": int(mask.sum()),
            "share": share(a),
            "rest": share(b),
            "diff": share(a) - share(b),
            "diff_lo": float(lo),
            "diff_hi": float(hi),
        }
    return out


def volatility_mix(full: pd.DataFrame, mgr_ids: list[str]) -> dict:
    """Are the manager's bottom 10 over-represented in high/very-high volatility? Fisher exact (one-sided, greater)."""
    f = full.reset_index()
    hv = f.volatility_class.isin(HIGH_VOL)
    m = f.machine_id.isin(mgr_ids)
    table = [[int((m & hv).sum()), int((m & ~hv).sum())], [int((~m & hv).sum()), int((~m & ~hv).sum())]]
    odds, p = stats.fisher_exact(table, alternative="greater")
    return {
        "table": table,
        "odds_ratio": float(odds),
        "p_value": float(p),
        "manager_high": table[0][0],
        "manager_n": int(m.sum()),
        "floor_high_share": float(hv.mean()),
    }


def run(full: pd.DataFrame, mgr_ids: list[str], start: date, end: date) -> dict:
    from pipeline.scorecard import prepare_days

    md = prepare_days(start, end)
    return {
        "moved": moved_experiment(md),
        "noise": residual_sd(md),
        "carded": carded_share(full, mgr_ids),
        "volatility": volatility_mix(full, mgr_ids),
    }
