"""M10: concentration math, change point recovery, comps not double-counted, player export is aggregate-only."""

import json

import numpy as np

from pipeline.comps import change_point, sse_split
from pipeline.config import WEB_DATA
from pipeline.players import lorenz, top_share


def test_lorenz_equal_and_concentrated():
    curve, g = lorenz(np.ones(100))
    assert abs(g) < 1e-3 and abs(curve[25] - 0.5) < 1e-6
    v = np.zeros(100)
    v[-1] = 1.0
    _, g2 = lorenz(v)
    assert g2 > 0.97
    assert top_share(v, 0.01) == 1.0


def test_sse_split_recovers_planted_break():
    rng = np.random.default_rng(0)
    y = np.r_[rng.normal(1.0, 0.05, 15), rng.normal(1.2, 0.05, 10)]
    k, d = sse_split(y)
    assert k == 15 and 0.15 < d < 0.25
    cp = change_point(y, n_boot=200)
    assert cp["k_lo"] <= 15 <= cp["k_hi"] and cp["effect_lo"] < 0.2 < cp["effect_hi"]
    assert cp["p_null"] < 0.05


def test_no_break_is_flagged_as_chance():
    y = np.random.default_rng(1).normal(1.0, 0.05, 25)
    assert change_point(y, n_boot=200)["p_null"] > 0.05


def test_comps_counted_once():
    c = json.loads((WEB_DATA / "comps.json").read_text(encoding="utf-8"))
    f = c["fnb"]
    assert abs(f["comped_cogs"] - f["ledger_cost"]) < 1.0
    assert abs(f["paid_cogs"] + f["comped_cogs"] - f["all_cogs"]) < 1.0


def test_players_export_is_aggregate():
    p = json.loads((WEB_DATA / "players_segments.json").read_text(encoding="utf-8"))
    assert set(p) >= {"segments", "cube", "dims"}
    players = p["segments"]["data"]["players"]
    assert min(players) >= 100, "a published segment covers fewer than 100 players"
    assert min(p["cube"]["data"]["players"]) >= 10, "a published cube cell covers fewer than 10 players"
