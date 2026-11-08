"""M12: claims appendix completeness, approved wording, and every deep link lands on a real route + anchor."""

import json
import re
from pathlib import Path

from pipeline.claims import APPROVED
from pipeline.config import WEB_DATA

ROOT = Path(__file__).resolve().parents[1]
# Chapter route -> screen files that render it (chapters compose the earlier screens).
SCREENS = {
    "/": ["Question"],
    "/why": ["Why", "ModelLab"],
    "/floor": ["Floor", "FloorMap", "Demand", "Downtime", "ModelLab"],
    "/guests": ["Guests", "Players", "Comps"],
    "/plan": ["BudgetPlan"],
    "/evidence": ["Evidence", "Methodology", "ModelLab"],
}
# Old routes redirect (web/src/components/shell/nav.ts REDIRECTS); focus overrides move single anchors.
REDIRECTS = {
    "/model": ("/why", {"model2": "/floor", "importance": "/evidence"}),
    "/demand": ("/floor", {}),
    "/downtime": ("/floor", {}),
    "/players": ("/guests", {}),
    "/comps": ("/guests", {}),
    "/method": ("/evidence", {}),
}
FIELDS = ("claim", "source", "result", "alternative", "limitation", "link")
FORBIDDEN = re.compile(r"fraud|cheat|theft|rigged|suspect|caught", re.I)


def _claims() -> list[dict]:
    return json.loads((WEB_DATA / "claims.json").read_text(encoding="utf-8"))["claims"]


def test_at_least_12_complete_claims():
    c = _claims()
    assert len(c) >= 12
    assert len({x["id"] for x in c}) == len(c)
    for x in c:
        assert all(x[f].strip() for f in FIELDS), x["id"]


def test_approved_claim_verbatim_and_required_notes():
    c = _claims()
    assert c[0]["claim"] == APPROVED
    md = (ROOT / "docs" / "claims_appendix.md").read_text(encoding="utf-8")
    assert APPROVED in md
    assert "set after seeing" in md and "0.77" in md and "0.52" in md
    assert any(x["id"] == "game-setting" for x in c)
    assert len(re.findall(r"^\| \d+ \|", md, re.M)) == len(c)


def test_deep_links_resolve():
    for x in _claims():
        path, _, qs = x["link"].partition("?")
        focus = dict(p.split("=", 1) for p in qs.split("&") if p).get("focus")
        if path in REDIRECTS:
            to, over = REDIRECTS[path]
            path = over.get(focus, to)
        assert path in SCREENS, x["link"]
        if focus:
            src = "".join((ROOT / "web" / "src" / "screens" / f"{f}.tsx").read_text(encoding="utf-8") for f in SCREENS[path])
            assert re.search(rf'id="{re.escape(focus)}"', src), f"{x['id']}: #{focus} not on {path}"


def test_vocabulary():
    for x in _claims():
        assert not FORBIDDEN.search(json.dumps(x)), x["id"]
