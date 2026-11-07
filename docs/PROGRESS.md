# Progress log

Resume point for a fresh session: read this file, then `python run.py all`.

## M0 · Setup & data audit — done
- Built: scaffold, `.venv` (Py 3.12 via uv), pinned `requirements.txt`, `config.yaml`, `pipeline/{config,load,checks}.py`, `run.py`, `Makefile`.
- Metrics: `python run.py check` → 38/38 PASS (23 row counts vs manifest, rules 1–12, column-name verification).
- Data facts found: game_math has `payout_multiplier_variance` and machine_day has `sum_bet_squared` → exact analytic SD(win) per day = sqrt(var × Σbet²). Only 4 machines ever moved (moved-machine experiment will be thin). No config changes mid-period. 1,207 of 1,226 operations are fault_repair. Walkway W-ENT-B40 closed for renovation 2025-03-03 → 2025-04-07.
- Early lead: manager's bottom 10 is 9/10 in zone Z-B40; M-1158 holds 3.0% vs 10% expected over 181 days.
- Next: M1.

## M1 · Scorecard, luck, hold gap, verdicts v1 — done (~1 h)
- Built: `scorecard.py` (build_scorecard(start,end), frozen schema), `luck.py` (exact analytic Var = payout_multiplier_variance × Σbet² + 7-day moving-block bootstrap, 1,000 resamples, seed 42), `holdgap.py` (z, BH-FDR 10%, split-half sign, config-mismatch best-fit), `shrinkage.py` (normal-normal EB toward 1), `downtime.py` (lost coin-in/theo lo/mid/hi), `verdicts.py`, `run_all.py`, `tests/test_money_math.py` (9 pass).
- Metrics: manager list == guide SQL (asserted). 2,762 scorecard rows (9 periods). 1 hold flag after FDR: M-1158 (3.0% vs 10.0%, z=−4.6; best-fit setting G-VID95 → configuration-mismatch lead). Full-period verdicts (provisional): inspect 1 · downtime 0 · location 34 · luck 19 · truly_weak 136 · ok 120.
- Findings: total downtime is small — 5,021 unavailable machine-hours ≈ $94k lost theo (range $80k–$106k) vs $23.5M theo (0.4%). Zone Z-B40 coin-in/hr fell 137→100 in March (walkway W-ENT-B40 closed 03-03→04-07). 4 of manager's 10 run G-VID95 (5% configured hold): low win by design.
- Open: provisional expectation = zone × weekday, ignores game → truly_weak inflated and our 10 is all Comet Cash (G-HIGH92 draws ~20% less coin-in/hr). Fixed by Model 1 (M6).
- Next: M2.

## M2 · Model 2 floor forecast + leakage tests; handoff schema FROZEN — done (~30 min)
- Built: `model_floor.py` (Jan–Apr weekday mean × citywide-event uplift, only events announced by 2025-04-30), `forecast_holdout.parquet`, `tests/test_no_leakage.py` (8 tests: split order, disjoint train/test, params invariant to test outcomes, announced-only events, prior-day lags, no real_sources inputs, dated placement join, holdout schema). 17/17 tests pass.
- Metrics (test May–Jun, 61 days): MAE $63.9k vs constant-mean baseline $218.3k (−70.7%); WAPE 4.7% vs 16.1%. Weekday-only MAE $68.7k → event uplift (×1.072, 20 train event-days) adds 7%.
- Findings: Sat/Fri peak, Tue/Wed trough, peak/trough 1.64×. Model over-forecasts by +$45k/day in May–Jun (June +$59k): floor demand drifted down after April.
- Schema G frozen: machine_scorecard.parquet (18 frozen cols first), forecast_holdout.parquet (gaming_date, actual, pred_model, pred_baseline), build_scorecard(start, end).
- Next: M3.
