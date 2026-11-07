import numpy as np
import pandas as pd

from pipeline import alternatives


def _days(rate_mult: float, spot_mult: float, n: int = 30) -> pd.DataFrame:
    """One machine moved after n days; a 2-machine peer bank per spot; spot expectation x spot_mult after the move."""
    dates = pd.date_range("2025-01-01", periods=2 * n)
    rows = []
    for i, d in enumerate(dates):
        after = i >= n
        loc, bank = ("L-2", "B-2") if after else ("L-1", "B-1")
        spot = 100.0 * (spot_mult if after else 1.0)
        rows.append(
            {
                "machine_id": "M-1",
                "gaming_date": d,
                "location_id": loc,
                "zone_id": "Z",
                "bank_id": bank,
                "available_hours": 10.0,
                "coin_in_usd": 10 * 100.0 * (rate_mult if after else 1.0),
                "loc_expected_coin_in_usd": 10 * spot,
            }
        )
        rows.append(
            {
                "machine_id": "M-P" + bank,
                "gaming_date": d,
                "location_id": loc + "x",
                "zone_id": "Z",
                "bank_id": bank,
                "available_hours": 10.0,
                "coin_in_usd": 10 * spot,
                "loc_expected_coin_in_usd": 10 * spot,
            }
        )
    return pd.DataFrame(rows)


def test_follows_spot_gives_beta_one():
    r = alternatives.moved_experiment(_days(rate_mult=1.5, spot_mult=1.5))
    assert r["n_moves"] == 1
    assert np.isclose(r["beta_model"], 1.0) and np.isclose(r["beta_peer"], 1.0)


def test_stays_with_machine_gives_beta_zero():
    r = alternatives.moved_experiment(_days(rate_mult=1.0, spot_mult=1.5))
    assert np.isclose(r["beta_model"], 0.0) and r["decision"] == "stays_with_machine"


def test_short_placement_excluded():
    r = alternatives.moved_experiment(_days(1.5, 1.5, n=10))
    assert r["n_moves"] == 0


def test_volatility_fisher_table_sums():
    full = pd.DataFrame({"machine_id": [f"M-{i}" for i in range(20)], "volatility_class": ["high"] * 5 + ["low"] * 15}).set_index(
        "machine_id"
    )
    v = alternatives.volatility_mix(full, ["M-0", "M-1", "M-10"])
    assert sum(map(sum, v["table"])) == 20 and v["manager_high"] == 2 and 0 < v["p_value"] <= 1
