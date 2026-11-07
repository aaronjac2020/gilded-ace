"""Hold-gap test: is observed hold further from the configured hold than luck allows?

A flag is a lead to inspect and verify, never evidence of wrongdoing.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from pipeline.config import cfg
from pipeline.load import table


def bh_reject(p: np.ndarray, q: float) -> np.ndarray:
    """Benjamini-Hochberg: boolean mask of rejected hypotheses at FDR q (NaN p never rejected)."""
    p = np.asarray(p, dtype=float)
    ok = np.isfinite(p)
    out = np.zeros_like(p, dtype=bool)
    pv = p[ok]
    if not len(pv):
        return out
    order = np.argsort(pv)
    m = len(pv)
    thresh = q * np.arange(1, m + 1) / m
    passed = pv[order] <= thresh
    k = np.max(np.nonzero(passed)[0]) + 1 if passed.any() else 0
    rej = np.zeros(m, dtype=bool)
    rej[order[:k]] = True
    out[np.nonzero(ok)[0]] = rej
    return out


def _gap_stats(md: pd.DataFrame) -> pd.DataFrame:
    """Machine grain: hold_obs, hold_expected (coin-in weighted 1-RTP), analytic SE, z, two-sided p."""
    g = md.groupby("machine_id").agg(
        win=("house_win_usd", "sum"), theo=("theo_usd", "sum"), ci=("coin_in_usd", "sum"), var=("var_win_usd2", "sum")
    )
    ci = g["ci"].where(g["ci"] > 0)
    out = pd.DataFrame(index=g.index)
    out["hold_obs"] = g["win"] / ci
    out["hold_expected"] = g["theo"] / ci
    out["hold_se"] = np.sqrt(g["var"]) / ci
    out["hold_gap_z"] = (out["hold_obs"] - out["hold_expected"]) / out["hold_se"]
    out["hold_gap_p"] = 2 * stats.norm.sf(np.abs(out["hold_gap_z"]))
    return out


def hold_gap_test(md: pd.DataFrame) -> pd.DataFrame:
    """Machine grain. md = on-floor machine-days for one period, with var_win_usd2.

    Flag (hold_flag) when BH-FDR rejects at q AND the gap has the same sign in both halves
    of the period (guards against a single lucky/unlucky stretch).
    """
    q = cfg()["holdgap"]["fdr_q"]
    full = _gap_stats(md)
    dates = np.sort(md["gaming_date"].unique())
    mid = dates[len(dates) // 2 - 1] if len(dates) > 1 else dates[0]
    h1 = _gap_stats(md[md["gaming_date"] <= mid])["hold_gap_z"].rename("z_half1")
    h2 = _gap_stats(md[md["gaming_date"] > mid])["hold_gap_z"].rename("z_half2")
    out = full.join(h1).join(h2)
    out["bh_reject"] = bh_reject(out["hold_gap_p"].to_numpy(), q)
    same_sign = np.sign(out["z_half1"]) == np.sign(out["z_half2"])
    out["hold_flag"] = out["bh_reject"] & same_sign & np.sign(out["z_half1"]).eq(np.sign(out["hold_gap_z"]))
    return out.reset_index()


def config_mismatch(md: pd.DataFrame) -> pd.DataFrame:
    """Does a machine's observed hold and average bet fit a different published setting better?

    For each machine, z of observed hold against every game_math setting's 1-RTP (using the
    machine's own analytic SE), plus whether average bet sits inside the configured bet range.
    """
    gm = table("game_math")
    g = md.groupby("machine_id").agg(
        config_id=("config_id", "last"),
        n_configs=("config_id", "nunique"),
        win=("house_win_usd", "sum"),
        ci=("coin_in_usd", "sum"),
        var=("var_win_usd2", "sum"),
        spins=("paid_spins", "sum"),
    )
    g = g[g["ci"] > 0]
    hold = g["win"] / g["ci"]
    se = np.sqrt(g["var"]) / g["ci"]
    zs = pd.DataFrame({r.config_id: (hold - (1 - r.configured_rtp)) / se for r in gm.itertuples()})
    best = zs.abs().idxmin(axis=1)
    out = pd.DataFrame(
        {
            "machine_id": g.index,
            "config_id": g["config_id"].values,
            "config_changed": (g["n_configs"] > 1).values,
            "best_fit_config": best.values,
            "z_own": [zs.loc[m, c] for m, c in zip(g.index, g["config_id"], strict=True)],
            "z_best": [zs.loc[m, b] for m, b in zip(g.index, best, strict=True)],
            "avg_bet_usd": (g["ci"] / g["spins"].where(g["spins"] > 0)).values,
        }
    )
    rng = gm.set_index("config_id")[["min_bet_cents", "max_bet_cents"]] / 100.0
    out = out.join(rng, on="config_id")
    out["bet_in_range"] = out["avg_bet_usd"].between(out["min_bet_cents"], out["max_bet_cents"])
    thr = stats.norm.ppf(1 - cfg()["holdgap"]["fdr_q"] / 2)
    out["mismatch_lead"] = (out["best_fit_config"] != out["config_id"]) & (out["z_own"].abs() > thr) & (out["z_best"].abs() < thr)
    return out.drop(columns=["min_bet_cents", "max_bet_cents"])
