from pipeline import budget
from pipeline.budget import Line


def _mt(theo: float, voi: float) -> dict:
    pick = {
        "swaps": 3,
        "moves": 6,
        "theo_lo_usd": theo / 2,
        "theo_mid_usd": theo,
        "theo_hi_usd": theo * 1.5,
        "halfwidth_vs_control": 0.12,
    }
    pairs = [{"ours": f"M-{i}", "manager": f"M-{i + 10}"} for i in range(3)]
    return {"pick": pick, "pairs": pairs, "voi_usd": voi}


def _lines() -> list[Line]:
    return [
        Line("A-INSPECT", 1, ["M-90"], 0, 500, 900),
        Line("A-WAYFINDING", 1, ["Z-B40"], 1000, 2500, 4000),
        Line("A-REPLACE-LEASE", 1, ["M-91"], 0, 2000, 4000),
    ]


def test_move_test_replaces_lowest_value_line_at_type_cap():
    cat = budget.catalog()
    lines, cmp = budget.with_move_test(_lines(), _mt(3000, 9000), cat)
    assert cmp["included"] and cmp["replaces"] == "A-INSPECT"
    types = {ln.action_type_id for ln in lines}
    assert "A-MOVE-MACHINE" in types and len(types) <= 3
    assert not budget.validate(lines, cat)


def test_move_test_excluded_when_value_below_lowest_line():
    lines, cmp = budget.with_move_test(_lines(), _mt(100, 0), budget.catalog())
    assert not cmp["included"]
    assert "A-MOVE-MACHINE" not in {ln.action_type_id for ln in lines}
