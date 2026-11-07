"""Empirical-Bayes shrinkage of machine_effect toward 1 (= performs as its location + game predicts)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from pipeline.config import cfg


def shrink_effect(effect: pd.Series, se: pd.Series) -> pd.DataFrame:
    """Normal-normal EB: prior N(1, tau^2), likelihood N(effect, se^2).

    tau^2 by method of moments: var(effect) - mean(se^2), floored at a small positive value.
    Low-exposure machines (large se) are pulled hardest toward 1. Returns shrunk mean and 90% CI.
    """
    ok = effect.notna() & se.notna() & (se > 0)
    v = se**2
    tau2 = max(float(np.var(effect[ok] - 1, ddof=1) - np.mean(v[ok])), 1e-6) if ok.sum() > 2 else 1e-6
    w = tau2 / (tau2 + v)
    mean = 1 + w * (effect - 1)
    post_sd = np.sqrt(w * v)
    zc = stats.norm.ppf(0.5 + cfg()["bootstrap"]["ci"] / 2)
    return pd.DataFrame(
        {
            "machine_effect_shrunk": mean.where(ok),
            "effect_shrunk_lo": (mean - zc * post_sd).where(ok),
            "effect_shrunk_hi": (mean + zc * post_sd).where(ok),
            "shrink_weight": w.where(ok),
            "tau": np.sqrt(tau2),
        },
        index=effect.index,
    )
