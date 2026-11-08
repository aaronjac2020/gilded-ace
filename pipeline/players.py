"""Players: carded play per player, concentration (top shares, Lorenz, Gini) and segment breakdowns.

Everything leaving this module for the web is an aggregate over players; no player ids or player-level rows.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from pipeline.config import periods
from pipeline.load import sql

DIMS = {"tier": "opening_tier", "region": "home_region", "age": "age_band"}
TIER_ORDER = ["Base", "Gold", "Platinum"]
# Net per player (player's view: payout - coin-in). Symmetric edges; outer bins are open-ended.
NET_EDGES = [-np.inf, -5000, -2000, -1000, -500, -250, -100, -50, -25, 0, 25, 50, 100, 250, 500, 1000, np.inf]
LORENZ_POINTS = 50


def player_months() -> pd.DataFrame:
    """player_period rows with the player's fixed attributes (enrolment tier, region, age band)."""
    d = sql(
        """
        select pp.player_id, pp.period_month as month, p.opening_tier, p.home_region,
               coalesce(p.age_band, 'Unknown') as age_band,
               pp.observed_visits as visits, pp.sessions, pp.carded_play_hours as hours,
               pp.tracked_coin_in_usd as wagered, pp.tracked_payout_usd as returned, pp.tracked_net_usd as net,
               pp.theo_usd as theo, pp.comp_cost_usd as comp_cost, pp.comp_face_value_usd as comp_face,
               pp.points_earned, pp.points_redeemed
        from {player_period} pp join {players} p using (player_id)
        """
    )
    return d


def window_players(pm: pd.DataFrame, months: list[str]) -> pd.DataFrame:
    """One row per player active in the window, summed over its months."""
    w = pm[pm["month"].isin(months)]
    keys = ["player_id", *DIMS.values()]
    num = ["visits", "sessions", "hours", "wagered", "returned", "net", "theo", "comp_cost", "comp_face"]
    return w.groupby(keys, observed=True)[num].sum().reset_index()


def lorenz(values: np.ndarray, points: int = LORENZ_POINTS) -> tuple[list[float], float]:
    """Lorenz curve (cumulative share of total at evenly spaced population shares, ascending) and Gini.

    Meant for non-negative values (theo); net loss has winners, so it gets top shares only.
    """
    v = np.sort(np.asarray(values, dtype=float))
    n, tot = len(v), v.sum()
    if n == 0 or tot == 0:
        return [0.0] * (points + 1), float("nan")
    cum = np.concatenate([[0.0], np.cumsum(v)]) / tot
    xs = np.linspace(0, 1, points + 1)
    curve = np.interp(xs * n, np.arange(n + 1), cum)
    gini = 1 - 2 * np.trapezoid(np.interp(np.linspace(0, 1, 2001) * n, np.arange(n + 1), cum), dx=1 / 2000)
    return [round(float(c), 4) for c in curve], float(gini)


def top_share(values: np.ndarray, q: float) -> float:
    """Share of the total held by the top q fraction of players (ranked by the same value)."""
    v = np.sort(np.asarray(values, dtype=float))[::-1]
    tot = v.sum()
    k = max(1, int(np.ceil(q * len(v))))
    return float(v[:k].sum() / tot) if tot else float("nan")


def segment_stats(wp: pd.DataFrame) -> dict:
    """Per-player money, concentration and net distribution for one set of players."""
    n = len(wp)
    loss = -wp["net"].to_numpy()
    theo = wp["theo"].to_numpy()
    lt, gt = lorenz(theo)
    hist = pd.cut(wp["net"], NET_EDGES, right=False).value_counts(sort=False)
    return {
        "players": n,
        "wagered": float(wp["wagered"].sum()),
        "returned": float(wp["returned"].sum()),
        "net": float(wp["net"].sum()),
        "theo": float(theo.sum()),
        "visits": float(wp["visits"].sum()),
        "hours": float(wp["hours"].sum()),
        "median_net": float(np.median(wp["net"])) if n else 0.0,
        "winners_share": float((wp["net"] > 0).mean()) if n else 0.0,
        "top1_theo": top_share(theo, 0.01),
        "top10_theo": top_share(theo, 0.10),
        "top1_loss": top_share(loss, 0.01),
        "top10_loss": top_share(loss, 0.10),
        "gini_theo": gt,
        "lorenz_theo": lt,
        "net_hist": [int(c) for c in hist.to_numpy()],
    }


def segments(wp: pd.DataFrame) -> list[tuple[str, pd.DataFrame]]:
    """'all' plus one segment per value of each dimension (one-dimension drilldown)."""
    out = [("all", wp)]
    for dim, col in DIMS.items():
        for v in sorted(wp[col].dropna().unique(), key=str):
            out.append((f"{dim}:{v}", wp[wp[col] == v]))
    return out


def window_months() -> dict[str, list[str]]:
    out = {}
    for name, (a, b) in periods().items():
        out[name] = [m.strftime("%Y-%m") for m in pd.period_range(a, b, freq="M")]
    return out


def segment_table(pm: pd.DataFrame) -> pd.DataFrame:
    """period x segment -> stats (exact, computed over that window's players)."""
    rows = []
    for period, months in window_months().items():
        wp = window_players(pm, months)
        for seg, s in segments(wp):
            rows.append({"period": period, "segment": seg, **segment_stats(s)})
    return pd.DataFrame(rows)


def cube(pm: pd.DataFrame) -> pd.DataFrame:
    """tier x region x age x month aggregates (player-months summed; players = distinct active in the month)."""
    keys = ["month", *DIMS.values()]
    g = pm.groupby(keys, observed=True)
    c = g[["visits", "hours", "wagered", "returned", "net", "theo", "comp_cost", "comp_face"]].sum()
    c["players"] = g["player_id"].nunique()
    return c.reset_index().rename(columns={v: k for k, v in DIMS.items()})
