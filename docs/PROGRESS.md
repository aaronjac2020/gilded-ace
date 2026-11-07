# Progress log

Resume point for a fresh session: read this file, then `python run.py all`.

## M0 · Setup & data audit — done
- Built: scaffold, `.venv` (Py 3.12 via uv), pinned `requirements.txt`, `config.yaml`, `pipeline/{config,load,checks}.py`, `run.py`, `Makefile`.
- Metrics: `python run.py check` → 38/38 PASS (23 row counts vs manifest, rules 1–12, column-name verification).
- Data facts found: game_math has `payout_multiplier_variance` and machine_day has `sum_bet_squared` → exact analytic SD(win) per day = sqrt(var × Σbet²). Only 4 machines ever moved (moved-machine experiment will be thin). No config changes mid-period. 1,207 of 1,226 operations are fault_repair. Walkway W-ENT-B40 closed for renovation 2025-03-03 → 2025-04-07.
- Early lead: manager's bottom 10 is 9/10 in zone Z-B40; M-1158 holds 3.0% vs 10% expected over 181 days.
- Next: M1.
