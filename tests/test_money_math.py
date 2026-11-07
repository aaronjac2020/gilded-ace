"""Money math: ratio of sums, cents/USD, comps inside cogs, DST availability, luck variance."""

from datetime import date

import numpy as np
import pandas as pd
import pytest

from pipeline.holdgap import bh_reject
from pipeline.load import calendar, cents_to_usd, machine_days, sql, to_gaming_date
from pipeline.luck import block_indices
from pipeline.scorecard import FROZEN_COLUMNS, build_scorecard


@pytest.fixture(scope="module")
def jan() -> pd.DataFrame:
    return build_scorecard(date(2025, 1, 1), date(2025, 1, 31)).set_index("machine_id")


def test_cents_to_usd():
    assert cents_to_usd(12345) == 123.45
    assert cents_to_usd(pd.Series([100, -250])).tolist() == [1.0, -2.5]


def test_gaming_date_boundary():
    ts = pd.Series(pd.to_datetime(["2025-01-04 02:00", "2025-01-04 06:00", "2025-01-04 05:59"]))
    assert to_gaming_date(ts).dt.strftime("%Y-%m-%d").tolist() == ["2025-01-03", "2025-01-04", "2025-01-03"]


def test_hold_is_ratio_of_sums(jan):
    md = machine_days()
    m = md[(md.machine_id == "M-1158") & (md.gaming_date <= "2025-01-31")]
    ros = m.house_win_usd.sum() / m.coin_in_usd.sum()
    assert jan.loc["M-1158", "hold_obs"] == pytest.approx(ros)
    mean_daily = (m.house_win_usd / m.coin_in_usd).mean()
    assert abs(ros - mean_daily) > 1e-6  # the two definitions differ on real data


def test_availability_dst_denominator():
    cal = calendar()
    assert cal.set_index("gaming_date").loc["2025-03-08", "scheduled_hours"] == 23
    md = machine_days()
    d = md[md.gaming_date == "2025-03-08"]
    assert (d.scheduled_hours <= 23).all()
    sc = build_scorecard(date(2025, 3, 8), date(2025, 3, 8))
    assert (sc.availability <= 1 + 1e-9).all()


def test_offfloor_rows_excluded():
    md = machine_days()
    assert md.location_id.notna().all()
    assert len(md) == 56110 - 1018


def test_comps_inside_cogs_counted_once():
    r = sql(
        "select sum(pos_cash_usd) cash, sum(pos_cogs_usd) cogs, sum(comp_cost_usd) comp, sum(house_win_usd) win, "
        "sum(machine_supplied_costs_usd) + sum(tech_labor_cost_usd) sup, sum(contribution_after_supplied_costs_usd) contrib from {property_day}"
    ).iloc[0]
    # contribution = win + cash - cogs - supplied (machine + tech labor); comp NOT subtracted again
    assert r.contrib == pytest.approx(r.win + r.cash - r.cogs - r.sup, abs=1.0)
    assert r.contrib != pytest.approx(r.win + r.cash - r.cogs - r.sup - r.comp, abs=1.0)


def test_luck_residual_identity(jan):
    assert (jan.luck_resid_usd - (jan.house_win_usd - jan.theo_usd)).abs().max() < 1e-6
    assert ((jan.hold_expected - jan.theo_usd / jan.coin_in_usd).abs() < 1e-12).all()


def test_frozen_schema(jan):
    assert list(jan.reset_index().columns[: len(FROZEN_COLUMNS)]) == FROZEN_COLUMNS


def test_bh_and_bootstrap_helpers():
    p = np.array([0.001, 0.02, 0.04, 0.5, np.nan])
    assert bh_reject(p, 0.10).tolist() == [True, True, True, False, False]
    idx = block_indices(20, np.random.default_rng(42), 5, 7)
    assert idx.shape == (5, 20) and idx.max() < 20
    assert (np.diff(idx[:, :7], axis=1) == 1).all()  # first block is contiguous
