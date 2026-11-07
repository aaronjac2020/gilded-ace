"""Luck quantification: analytic SD of house win + 7-day block bootstrap CIs."""

from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.config import cfg
from pipeline.load import table


def add_daily_variance(md: pd.DataFrame) -> pd.DataFrame:
    """Add var_win_usd2: per machine-day variance of house win in USD^2.

    Each spin's house win is bet x (1 - payout multiplier), so Var = bet^2 x Var(mult).
    Summed over spins: Var(day) = payout_multiplier_variance x sum_bet_squared (cents^2) / 1e4.
    This is exact given the published game math; no bet-size approximation is needed.
    """
    gm = table("game_math")[["config_id", "payout_multiplier_variance"]]
    out = md.merge(gm, on="config_id", how="left")
    out["var_win_usd2"] = out["payout_multiplier_variance"] * out["sum_bet_squared"] / 1e4
    return out


def block_indices(n: int, rng: np.random.Generator, resamples: int, block: int) -> np.ndarray:
    """Moving-block bootstrap index matrix (resamples x n) over n ordered days."""
    if n <= block:
        return rng.integers(0, n, size=(resamples, n))
    k = -(-n // block)
    starts = rng.integers(0, n - block + 1, size=(resamples, k))
    idx = (starts[:, :, None] + np.arange(block)[None, None, :]).reshape(resamples, -1)
    return idx[:, :n]


def bootstrap_machine(
    days: pd.DataFrame, rng: np.random.Generator, cols: dict[str, tuple[str, str]], resamples: int, block: int
) -> dict[str, np.ndarray]:
    """Bootstrap ratio-of-sums statistics for one machine's ordered days.

    cols maps stat name -> (numerator column, denominator column or "" for a plain sum).
    Returns stat name -> array of resampled values.
    """
    idx = block_indices(len(days), rng, resamples, block)
    out = {}
    for name, (num, den) in cols.items():
        n = days[num].to_numpy()[idx].sum(axis=1)
        if den:
            d = days[den].to_numpy()[idx].sum(axis=1)
            with np.errstate(invalid="ignore", divide="ignore"):
                out[name] = np.where(d != 0, n / d, np.nan)
        else:
            out[name] = n
    return out


def bootstrap_cis(md: pd.DataFrame, seed: int | None = None) -> pd.DataFrame:
    """Per-machine 90% block-bootstrap CIs on hold, luck residual and machine effect.

    md: on-floor machine-days for one period with columns house_win_usd, coin_in_usd,
    luck_usd (= win - theo) and loc_expected_coin_in_usd. Grain of output: machine.
    """
    c = cfg()
    seed = c["seed"] if seed is None else seed
    resamples, block = c["bootstrap"]["resamples"], c["bootstrap"]["block_days"]
    a = (1 - c["bootstrap"]["ci"]) / 2
    rng = np.random.default_rng(seed)
    cols = {
        "hold": ("house_win_usd", "coin_in_usd"),
        "luck": ("luck_usd", ""),
        "effect": ("coin_in_usd", "loc_expected_coin_in_usd"),
    }
    rows = []
    for mid, g in md.sort_values(["machine_id", "gaming_date"]).groupby("machine_id", sort=True):
        b = bootstrap_machine(g, rng, cols, resamples, block)
        r = {"machine_id": mid}
        for k, v in b.items():
            r[f"{k}_ci_lo"], r[f"{k}_ci_hi"] = np.nanquantile(v, [a, 1 - a]) if np.isfinite(v).any() else (np.nan, np.nan)
            r[f"{k}_boot_se"] = np.nanstd(v)
        rows.append(r)
    return pd.DataFrame(rows)
