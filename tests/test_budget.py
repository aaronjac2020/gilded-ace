"""M11: budget rules (cost formula, cap, type cap, incompatibilities) and the exported plan the allocator starts from."""

import json

import pytest

from pipeline import budget
from pipeline.budget import Line
from pipeline.config import WEB_DATA, cfg


@pytest.fixture(scope="module")
def cat():
    return budget.catalog()


@pytest.fixture(scope="module")
def plan() -> dict:
    return json.loads((WEB_DATA / "budget.json").read_text(encoding="utf-8"))


def test_lease_costs_3380(cat):
    # $2,500 setup + $55/day x (30 - 14 lead days) live = $3,380
    assert budget.line_cost("A-REPLACE-LEASE", 1, cat) == pytest.approx(3380.0)
    assert budget.line_cost("A-REPLACE-LEASE", 4, cat) == pytest.approx(13520.0)


def test_over_budget_blocked(cat):
    errs = budget.validate([Line("A-REPLACE-BUY", 5)], cat)  # 5 x $22,000 = $110,000
    assert any("exceeds" in e for e in errs)
    assert not budget.validate([Line("A-REPLACE-BUY", 4)], cat)  # $88,000


def test_at_most_three_types(cat):
    four = [Line("A-INSPECT", 1), Line("A-WAYFINDING", 1), Line("A-SURVEY", 1), Line("A-PROMO", 1)]
    assert any("action types" in e for e in budget.validate(four, cat))
    assert not budget.validate(four[:3], cat)
    assert not budget.validate(four[:3] + [Line("A-HOLD", 1)], cat), "keeping budget is not an action type"


def test_incompatible_combos(cat):
    comp = budget.validate([Line("A-COMP-PILOT", 1), Line("A-COMP-CHANGE", 1)], cat)
    assert any("incompatible" in e for e in comp)
    same = [Line("A-REPLACE-LEASE", 1, ["M-1001"]), Line("A-MOVE-MACHINE", 1, ["M-1001"])]
    assert any("incompatible on M-1001" in e for e in budget.validate(same, cat))
    apart = [Line("A-REPLACE-LEASE", 1, ["M-1001"]), Line("A-MOVE-MACHINE", 1, ["M-1002"])]
    assert not budget.validate(apart, cat)


def test_quantity_limit(cat):
    assert any("limit" in e for e in budget.validate([Line("A-WAYFINDING", 3)], cat))


def test_best_plan_respects_rules(cat):
    pool = [
        Line("A-REPLACE-LEASE", 1, ["M-1"]),
        Line("A-MOVE-MACHINE", 1, ["M-1"]),
        Line("A-INSPECT", 1, ["M-2"]),
        Line("A-WAYFINDING", 1, ["Z-1"]),
    ]
    value = {"A-REPLACE-LEASE": 5.0, "A-MOVE-MACHINE": 4.0, "A-INSPECT": 3.0, "A-WAYFINDING": 2.0}
    pick, v = budget.best_plan(pool, value, cat)
    assert pick == ("A-INSPECT", "A-REPLACE-LEASE", "A-WAYFINDING") and v == 10.0


def test_exported_plan_is_valid_and_totals_match(plan, cat):
    rec = plan["recommended"]["data"]
    lines = [
        Line(a, q, [t for t in ts.split(", ") if t])
        for a, q, ts in zip(rec["action_type_id"], rec["quantity"], rec["targets"], strict=True)
    ]
    assert not budget.validate(lines, cat) and not plan["errors"]
    assert plan["total_usd"] == pytest.approx(budget.plan_total(lines, cat))
    assert plan["total_usd"] == pytest.approx(sum(rec["cost_usd"]))
    assert plan["total_usd"] + plan["kept_usd"] == pytest.approx(cfg()["budget"]["total_usd"])
    assert plan["total_usd"] <= cfg()["budget"]["total_usd"] and len(set(rec["action_type_id"])) <= 3
    assert sorted(plan["optimizer_pick"]) == sorted(rec["action_type_id"]), "exhaustive search disagrees with the plan"
