"""Web export: schemas, size cap, no player-level identifiers."""

import json
import re

import pytest

from pipeline.config import WEB_DATA, cfg, periods
from pipeline.scorecard import FROZEN_COLUMNS

REQUIRED = [
    "meta.json",
    "machines.json",
    "floor.json",
    "placements.json",
    "machine_day_slim.json",
    "lists.json",
    "demand.json",
    "downtime.json",
    "players_segments.json",
    "comps.json",
    "model_lab.json",
    "budget.json",
    "claims.json",
]

pytestmark = pytest.mark.skipif(not (WEB_DATA / "meta.json").exists(), reason="run `python run.py export` first")


def test_required_files_present():
    names = {p.name for p in WEB_DATA.glob("*.json")}
    missing = [f for f in REQUIRED + [f"scorecard_{p}.json" for p in periods()] if f not in names]
    assert not missing, missing


def test_total_size_under_cap():
    total = sum(p.stat().st_size for p in WEB_DATA.glob("*.json"))
    assert total <= cfg()["web"]["max_total_mb"] * 1024 * 1024


def test_scorecard_frozen_columns():
    sc = json.loads((WEB_DATA / "scorecard_full.json").read_text(encoding="utf-8"))
    cols = [c for c in FROZEN_COLUMNS if c != "period"]
    assert sc["columns"][: len(cols)] == cols
    assert len(sc["data"]["machine_id"]) == 310


def test_no_player_identifiers():
    pat = re.compile(r'"(player_id|guest_id|card_number|loyalty_id|session_id|trip_id|first_name|last_name|email)"')
    pid = re.compile(r'"P-\d{4,}"')
    for p in WEB_DATA.glob("*.json"):
        s = p.read_text(encoding="utf-8")
        assert not pat.search(s), f"{p.name} has a player-level key"
        assert not pid.search(s), f"{p.name} has a player id value"


def test_columnar_shape():
    for p in WEB_DATA.glob("scorecard_*.json"):
        c = json.loads(p.read_text(encoding="utf-8"))
        n = {len(v) for v in c["data"].values()}
        assert len(n) == 1 and set(c["columns"]) == set(c["data"])
