"""Comps: cost (economic, from the loyalty ledger), reinvestment rate (comp cost / carded theo) and one change point.

Double counting: comp redemptions also appear in fnb with cash 0 and their COGS. Comp cost here is the ledger's
economic cost (equal to those COGS), so F&B margin must exclude comp rows (`fnb_cash_margin`).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.load import GAMING_DAY_START_HOUR, sql

# Ledger timestamps are UTC; Las Vegas is UTC-8 (PST) / UTC-7 (PDT). A fixed 14 h shift maps UTC to the gaming day under
# PST; under PDT redemptions between 05:00 and 06:00 local land a day early. Weekly sums are insensitive to this.
UTC_TO_GAMING_HOURS = 8 + GAMING_DAY_START_HOUR


def weekly() -> pd.DataFrame:
    """Full Monday-start gaming weeks: carded theo/coin-in, comp cost/face, points earned/redeemed and derived rates."""
    w = sql(
        f"""
        with t as (
            select date_trunc('week', gaming_date) as week, sum(theo_cents) / 100 as theo, sum(coin_in_cents) / 100 as coin_in,
                   count(distinct gaming_date) as days
            from {{sessions}} where player_id is not null group by 1),
        c as (
            select date_trunc('week', event_at_utc - interval {UTC_TO_GAMING_HOURS} hour) as week,
                   sum(case when event_type = 'redeem' then economic_cost_cents end) / 100 as comp_cost,
                   sum(case when event_type = 'redeem' then face_value_cents end) / 100 as comp_face,
                   count(case when event_type = 'redeem' then 1 end) as redemptions,
                   sum(case when event_type = 'redeem' then -points_delta end) as points_redeemed,
                   sum(case when event_type = 'award' then points_delta end) as points_earned
            from {{loyalty_ledger}} group by 1)
        select * from t join c using (week) where days = 7 order by week
        """
    )
    w["week"] = pd.to_datetime(w["week"])
    w["reinvestment"] = w["comp_cost"] / w["theo"]
    w["earn_rate"] = w["points_earned"] / w["coin_in"]  # points per $ wagered
    w["points_per_dollar"] = w["points_redeemed"] / w["comp_face"]  # redemption price, points per $ of face value
    w["cost_per_face"] = w["comp_cost"] / w["comp_face"]
    return w


def sse_split(y: np.ndarray, min_seg: int = 4) -> tuple[int, float]:
    """Single mean-shift change point: index k (first point of the after segment) minimising total SSE; returns (k, delta)."""
    y = np.asarray(y, dtype=float)
    n = len(y)
    best, bk = np.inf, min_seg
    for k in range(min_seg, n - min_seg + 1):
        a, b = y[:k], y[k:]
        sse = ((a - a.mean()) ** 2).sum() + ((b - b.mean()) ** 2).sum()
        if sse < best:
            best, bk = sse, k
    return bk, float(y[bk:].mean() - y[:bk].mean())


def change_point(y: np.ndarray, n_boot: int = 2000, block: int = 3, seed: int = 11, min_seg: int = 4, n_perm: int = 5000) -> dict:
    """SSE change point with a moving-block bootstrap of residuals around the fitted two-mean model.

    Returns the split index, effect (after - before mean), 90% CIs on both, and the share of resamples that land within
    +-1 week of the point estimate. Also a no-change baseline: the effect found when blocks are resampled from the
    pooled series (no shift), giving the max |effect| a split finds by chance. p_perm: permutation test that shuffles the
    weeks and re-runs the full split search on each shuffle (own RNG, so the bootstrap numbers are unchanged).
    """
    y = np.asarray(y, dtype=float)
    n = len(y)
    k, d = sse_split(y, min_seg)
    fit = np.where(np.arange(n) < k, y[:k].mean(), y[k:].mean())
    res = y - fit
    rng = np.random.default_rng(seed)

    def resample(r: np.ndarray) -> np.ndarray:
        starts = rng.integers(0, n - block + 1, size=int(np.ceil(n / block)))
        return np.concatenate([r[s : s + block] for s in starts])[:n]

    ks, ds, null = [], [], []
    pooled = y - y.mean()
    for _ in range(n_boot):
        kb, db = sse_split(fit + resample(res), min_seg)
        ks.append(kb)
        ds.append(db)
        null.append(abs(sse_split(y.mean() + resample(pooled), min_seg)[1]))
    ks, ds = np.array(ks), np.array(ds)
    return {
        "k": int(k),
        "effect": d,
        "before": float(y[:k].mean()),
        "after": float(y[k:].mean()),
        "k_lo": int(np.quantile(ks, 0.05)),
        "k_hi": int(np.quantile(ks, 0.95)),
        "effect_lo": float(np.quantile(ds, 0.05)),
        "effect_hi": float(np.quantile(ds, 0.95)),
        "within_1wk": float(np.mean(np.abs(ks - k) <= 1)),
        "null_effect_p95": float(np.quantile(null, 0.95)),
        "p_null": float(np.mean(np.array(null) >= abs(d))),
        "p_perm": permutation_p(y, d, n_perm, min_seg),
        "n_perm": n_perm,
    }


def permutation_p(y: np.ndarray, effect: float, n_perm: int = 5000, min_seg: int = 4, seed: int = 29) -> float:
    """Share of week-order shuffles whose best split finds |effect| at least as large (add-one corrected)."""
    rng = np.random.default_rng(seed)
    hits = sum(abs(sse_split(rng.permutation(y), min_seg)[1]) >= abs(effect) for _ in range(n_perm))
    return float((hits + 1) / (n_perm + 1))


def by_segment(month_col: str = "month") -> pd.DataFrame:
    """Comp cost, face and theo by month x tier x region (from player_period; equals the ledger's economic cost)."""
    return sql(
        f"""
        select pp.period_month as {month_col}, p.opening_tier as tier, p.home_region as region,
               sum(pp.comp_cost_usd) as comp_cost, sum(pp.comp_face_value_usd) as comp_face, sum(pp.theo_usd) as theo,
               sum(pp.comps_redeemed) as redemptions, count(distinct case when pp.comps_redeemed > 0 then pp.player_id end) as redeemers,
               count(distinct pp.player_id) as players
        from {{player_period}} pp join {{players}} p using (player_id)
        group by 1, 2, 3 order by 1, 2, 3
        """
    )


def fnb_cash_margin() -> dict:
    """F&B paid vs comped rows, so comps are not counted twice (once as comp cost, again as F&B COGS)."""
    f = sql(
        """
        select comp_id is not null as comped, count(*) as n, sum(cash_receipt_cents) / 100 as cash,
               sum(face_value_cents) / 100 as face, sum(cogs_cents) / 100 as cogs
        from {fnb} group by 1
        """
    ).set_index("comped")
    ledger = float(sql("select sum(economic_cost_cents) / 100 as c from {loyalty_ledger} where event_type = 'redeem'").c[0])
    paid, comped = f.loc[False], f.loc[True]
    return {
        "paid_cash": float(paid.cash),
        "paid_cogs": float(paid.cogs),
        "comped_cogs": float(comped.cogs),
        "comped_face": float(comped.face),
        "ledger_cost": ledger,
        "all_cogs": float(f.cogs.sum()),
    }
