# AI disclosure

**Tools used:** Claude Code (Anthropic, Claude Opus models) as a coding assistant, in the terminal and in Windsurf.

## What AI did

- Wrote and refactored most of the code: the Python pipeline (`pipeline/`), tests (`tests/`), the React dashboard (`web/`) and the check scripts (`web/scripts/`), working from specs and milestones Aaron wrote.
- Ran the pipeline, tests, type checks, builds, Lighthouse and the Playwright judge checks, and fixed what failed.
- Drafted the dashboard copy, the claims appendix wording, this write-up, the video script and the Devpost text, all for Aaron to edit.
- Acted as a design critic and a "cold viewer" (subagents scoring each chapter for clarity and trust). Their scores drove copy and layout fixes.

## What Aaron did

- Chose the question (should the manager cut the bottom 10?), the analysis approach and the $100k plan rules.
- Approved the headline claim wording and froze the numbers before the redesign. After the freeze, AI could change presentation only, not results.
- Reviewed the outputs, set the constraints (no player-level data on the web, no blame language, synthetic-data framing on every page), and records the video.

## Guardrails

- **Every number on the dashboard comes from the pipeline**, not from model text. The web reads only `web/public/data/*.json`, which `pipeline/export.py` writes. `scripts/consistency.mjs` checks the counts in the DOM against the data.
- **Reproducible:** `python run.py all` rebuilds everything, and `outputs/fingerprint.json` lists SHA-256 hashes a rerun must match (shown on `/evidence#reproduce`).
- **Leakage tests** (`tests/test_no_leakage.py`): models are fit on Jan–Apr only and scored on May–Jun.
- **No real-world claims:** all data is the synthetic Gilded Ace release (`gilded-ace-v1`). No AI-generated data enters the analysis.
