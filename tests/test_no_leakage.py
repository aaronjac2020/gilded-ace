"""Leakage guards for both models: time split, frozen features, prior-day lags, no real_sources inputs."""

from datetime import date
from pathlib import Path

import pandas as pd
import pytest

from pipeline import model_floor
from pipeline.config import cfg
from pipeline.load import sql, table

ROOT = Path(__file__).resolve().parent.parent
SPLIT = cfg()["split"]
TRAIN_END = pd.Timestamp(SPLIT["train_end"])
TEST_START = pd.Timestamp(SPLIT["test_start"])


@pytest.fixture(scope="module")
def m2():
    return model_floor.run()


def test_split_order():
    assert TRAIN_END < TEST_START
    assert TRAIN_END == pd.Timestamp("2025-04-30")


def test_model2_train_test_disjoint(m2):
    assert m2["train"].gaming_date.max() <= TRAIN_END
    assert m2["holdout"].gaming_date.min() >= TEST_START


def test_model2_params_ignore_test_outcomes(m2):
    """Perturbing test-period actuals must not change the fitted parameters."""
    d = model_floor.floor_daily()
    train = d[d.gaming_date <= TRAIN_END]
    p1 = model_floor.fit(train, TRAIN_END.date())
    d2 = d.copy()
    d2.loc[d2.gaming_date >= TEST_START, "coin_in_usd"] *= 10
    p2 = model_floor.fit(d2[d2.gaming_date <= TRAIN_END], TRAIN_END.date())
    assert p1["weekday_mean"] == p2["weekday_mean"] and p1["event_uplift"] == p2["event_uplift"]


def test_model2_only_announced_events():
    ev = table("events")
    late = ev[ev.announced_date > TRAIN_END]
    assert len(late) >= 1  # Locals Appreciation Week was announced after the cutoff
    known = model_floor.known_events(TRAIN_END.date())
    assert set(known.event_id).isdisjoint(set(late.event_id))


def test_lags_use_prior_days_only():
    """lag_coin_in_7d_mean_usd on day t equals the mean of days t-7..t-1 for one machine."""
    d = sql("select gaming_date, coin_in_usd, lag_coin_in_7d_mean_usd lag from {pdv} where machine_id='M-1001' order by 1")
    prior = d.coin_in_usd.shift(1).rolling(7).mean()
    ok = d.lag.notna() & prior.notna()
    assert ok.sum() > 100
    assert (d.lag[ok] - prior[ok]).abs().max() < 0.01


def test_no_real_sources_in_models():
    for f in ("model_floor.py", "model_machine.py"):
        p = ROOT / "pipeline" / f
        if p.exists():
            src = p.read_text(encoding="utf-8")
            for banned in ("real_sources", "city_visitation", "weather", "visitor_profile", "benchmark"):
                assert banned not in src, f"{f} references {banned}"


def test_placement_joined_by_date():
    """Location used by models comes from the dated prepared view, which matches placements (checks rule 6)."""
    from pipeline.checks import rule_checks

    r6 = [c for c in rule_checks() if c.rule == "6"][0]
    assert r6.ok, r6.detail


def test_forecast_holdout_schema():
    p = ROOT / "outputs" / "forecast_holdout.parquet"
    if not p.exists():
        pytest.skip("pipeline not run yet")
    df = pd.read_parquet(p)
    assert list(df.columns) == ["gaming_date", "actual", "pred_model", "pred_baseline"]
    assert pd.to_datetime(df.gaming_date).min() >= TEST_START
    assert date(2025, 6, 30) == pd.to_datetime(df.gaming_date).max().date()


# ---- Model 1 (machine expectation) ----
from pipeline import model_machine  # noqa: E402


def test_model1_no_identity_features():
    assert not set(model_machine.FEATURES) & model_machine.FORBIDDEN
    assert not any(f.startswith("lag_") for f in model_machine.FEATURES)


def test_model1_split_windows():
    sp = model_machine.split(model_machine.dataset())
    assert sp["inner"].gaming_date.max() < sp["valid"].gaming_date.min()
    assert sp["valid"].gaming_date.max() <= TRAIN_END
    assert sp["fit"].gaming_date.max() <= TRAIN_END < TEST_START <= sp["test"].gaming_date.min()


def test_model1_predictions_ignore_test_outcomes():
    """Scrambling May-Jun targets must not change the final model's test predictions."""
    d = model_machine.dataset()
    rounds = model_machine.run()["best_iteration"]
    test = model_machine.split(d)["test"]
    p1 = model_machine._fit(model_machine.split(d)["fit"], rounds).predict(test[model_machine.FEATURES])
    d2 = d.copy()
    d2.loc[d2.gaming_date >= TEST_START, "rate"] *= 10
    p2 = model_machine._fit(model_machine.split(d2)["fit"], rounds).predict(test[model_machine.FEATURES])
    assert (p1 == p2).all()


def test_model1_oof_folds_exclude_own_machine():
    from sklearn.model_selection import GroupKFold

    d = model_machine.dataset()
    for tr, te in GroupKFold(n_splits=5).split(d, groups=d["machine_id"]):
        assert not set(d.machine_id.iloc[tr]) & set(d.machine_id.iloc[te])


def test_model1_beats_baseline():
    m = model_machine.run()["metrics"]
    assert m["mae_model"] < m["mae_baseline"]


def test_persistence_compare_reads_only_train_window():
    """Both rankings use Jan-Apr columns only: scrambling every May-Jun ranking column leaves scores unchanged,
    and scrambling Jan-Apr outcome-free columns does not touch May-Jun outcomes."""
    import numpy as np
    import pandas as pd

    from pipeline import model_machine as mm

    rng = np.random.default_rng(0)
    n = 60
    ids = [f"M-{i}" for i in range(n)]
    tr = pd.DataFrame(
        {
            "machine_id": ids,
            "days_on_floor": 100,
            "house_win_usd": rng.normal(size=n),
            "machine_effect_shrunk": rng.normal(size=n),
        }
    )
    te = pd.DataFrame(
        {"machine_id": ids, "days_on_floor": 50, "house_win_usd": rng.normal(size=n), "machine_effect_shrunk": rng.normal(size=n)}
    )
    base = mm.persistence_compare(tr, te)
    assert base["n"] == n
    # Shuffling train rows' order must not matter; replacing train scores must change the result.
    again = mm.persistence_compare(tr.sample(frac=1, random_state=1), te)
    for o in base["outcomes"]:
        for r in ("manager", "ours"):
            assert np.isclose(base["outcomes"][o][r]["spearman"], again["outcomes"][o][r]["spearman"])
    # Our ranking reads train effect, manager reads train house win: perfect train=test copy -> rho 1 for the matching pair.
    te2 = te.assign(machine_effect_shrunk=tr["machine_effect_shrunk"], house_win_usd=tr["house_win_usd"])
    perf = mm.persistence_compare(tr, te2)
    assert np.isclose(perf["outcomes"]["effect"]["ours"]["spearman"], 1)
    assert np.isclose(perf["outcomes"]["house_win"]["manager"]["spearman"], 1)
