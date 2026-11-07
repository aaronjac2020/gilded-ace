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

## M3 · Web export + scaffold + design system — done (~1 h)
- Built: `export_web.py` (columnar JSON + dictionary encoding for machine-day ids; fails if > 15 MB), `tests/test_exports.py` (5: files present, size cap, frozen cols, no player ids/keys, columnar shape). Web: Vite 8 + React 19 + TS + Tailwind 3 (v3 for the spec's tailwind.config.ts/postcss layout), tokens.ts → Tailwind + ECharts theme (tree-shaken echarts/core, loaded lazily with chart screens), AppShell (nav, period chips, zone/bank selects, filter pills, URL state), KpiCard/ChartCard (Show as table)/VerdictChip/EvidenceLink/AssertionTitle, 9 lazy routes.
- Metrics: web data 4.09 MB / 15 MB (machine_day_slim 2.4 MB). Entry JS 273 kB (87 kB gzip). typecheck + build clean. 22/22 pytest.
- Pending stubs ({"pending": "M<n>"}): demand, downtime, players_segments, comps, budget, claims.
- [assumption] @types/react, @types/react-dom added (types for pre-approved react; needed for TS).
- Next: M4.

## M4 · MVP screens — done (~1.5 h)
- Built: Verdict (manager vs ours with animated connectors, 4 KPIs + evidence links), Floor Map (D3 SVG: zone hulls, bank outlines → global bank filter, walkways with the closed B40 walkway dashed, verdict color+shape glyphs, legend with counts, hover tooltip, machine drawer via `?machine=`), Model Lab (split timeline, Model 2 pred vs actual, MAE/WAPE table, leakage checklist, "What this changed"), Plan (static v0 recommendation, budget bar + formula, per-line lo/mid/hi, measurement, evidence). `pipeline/budget.py` (catalog, cost formula, validation, v0 recommend) → budget.json. `scripts/judge-check.mjs` (Playwright; `--url`, `--only`).
- Metrics: judge 0/1/2/3/4/9 all PASS on preview — first load KPIs visible 435–650 ms (limit 3 s); period Full→Mar changes all 4 KPIs; bank B-01 drill changes Verdict KPIs; MAE table visible; no console errors. Entry JS 411 kB (134 kB gzip). 22/22 pytest, ruff clean.
- Budget v0: spend $42.5k, keep $57.5k, 30-day theo effect $8.7k–$45.8k (mid $22.9k) — below spend inside the horizon; M11 optimizer to revisit.
- Judge check 0 now uses page-side `performance.now()`; a single cold run measured 3.3 s wall (Google Fonts cold fetch), not reproducible (0.43–0.65 s after).
- Next: M5.

## M5 · Deploy prep — done (~10 min), STOP for Vercel
- `web/vercel.json` (vite framework, build `npm run build`, output `dist`, SPA rewrite for everything except /data and /assets, cache headers); `postbuild` copies dist/index.html → dist/404.html.
- `web/public/data/` (22 files, 4.2 MB, derived aggregates; 0 player-id matches) now committed — root `data/` ignore previously hid it, so a host build would have shipped with no data.
- Next: Aaron imports the repo on Vercel; then `npm run judge -- --url <URL>`; then M6.

## Deploy check · Netlify — blocked
- https://gildedaces.netlify.app returns 401 on every path (Visitor access protection → edge-access login); judge cannot run against it. Netlify SPA fallback (`web/public/_redirects`, `web/netlify.toml`) committed locally in 1d96a95, not pushed.

## M6 · Model 1 + rank persistence — done (~1.5 h)
- `pipeline/model_machine.py`: LightGBM coin-in/avail-hr per machine-day (weight = avail hrs), seed 42; rounds by early stopping on April (196), final fit Jan–Apr, test May–Jun. Features: zone, weekday, calendar, bank geometry, game config, `entrance_path_m` (daily Dijkstra over walkways honoring closures). No machine_id/location/bank/theme/lags (asserted + tested).
- Metrics: test MAE $890 vs zone×weekday $1,106 per machine-day (−19.5%); WMAPE 20.2% vs 25.1%. Top gain: weekday 29%, zone 26%, max bet 9%, hit prob 7%, RTP 6%, entrance path 5%.
- `location_expectation: model` — scorecard expectation = out-of-fold (GroupKFold 5 by machine) prediction × leave-one-machine-out zone×day calibration.
- What changed: truly_weak 136 → 60; our-10 themes 2 → 7; our-10 ∩ manager 2 → 0; 1/10 of old list kept. Manager's 10: 7 not truly weak (unchanged headline).
- Rank persistence Jan–Apr → May–Jun (n=307, ≥14 days each): Spearman 0.58 [0.51, 0.64]; precision@10 40% [19%, 65%] vs random 3%.
- Model Lab: Model 1 table, feature-importance chart (+table), persistence card with CIs, "What this changed". 5 new leakage tests (27/27 pass), ruff clean, judge 0–4/9 PASS on preview.
- Next: M7.

## M6.5 · Design System v2 — done (~2.75 h)
- Presentation only: no analysis, JSON schema, route or handoff changes.
- Tokens (oklch vars + canvas hex mirrors), Inter/JetBrains Mono self-hosted (Playfair and Google Fonts removed), 232/56px collapsible sidebar, 48px top bar with period control, filters popover, copy link, tour.
- Primitives in `web/src/components/ui/` (button, kbd, tooltip, tabs, status-pill, skeleton/empty/error, Num/Delta via NumberFlow, HeroBand/KpiStrip/Kpi, Tile with table toggle + ⋯ menu, RowList with J/K, CiBar).
- Shell: ⌘K command menu (screens, actions, periods, recent, 310 machines), G+key nav, [ ] months, ? sheet, 5-step tour, route fade, per-route titles, styled 404.
- Screens: Verdict and Model Lab/Plan on hero band + 12-col tiles; Floor Map full-bleed with zoom/minimap, color-by toggle, bank click → global filter with Undo toast, hover focus+context dimming; global vaul machine drawer (520px, tabs, ←/→, layoutId morph from list rows); stubs show the question + planned evidence, no numbers.
- Brand: GA monogram favicon (SVG + 32px PNG), OG 1200×630, theme-color #0A0909, JSON preload (`web/scripts/brand-assets.mjs`).
- Perf: overlays (drawer, ⌘K, tour) lazy-mounted on first use, framer-motion via LazyMotion; entry chunk 648 → 228 kB (72 kB gzip). Fixed echarts-for-react CJS default-interop crash on Model Lab.
- Checks: typecheck clean; judge 0–4/9 PASS locally; Lighthouse (local preview, desktop) Perf 91 · A11y 96 · BP 100; mobile-throttled Perf 59 (TBT from React render under 4× CPU). Accusatory-word and Playfair greps empty.
- Screenshots: `outputs/figures/ui_v2/{before,after}/` at 1440×900 and 1280×800.
- Next: M7.

## Pre-M7 · judge flake, manager-vs-ours persistence, Verdict tags — done (~1.5 h)
- Netlify (deployed): Lighthouse desktop Perf 96 · A11y 96 · BP 100 (LCP 0.7 s); mobile 69/100/100 (deferred to M13).
- Judge flake = check 0 (first load > 3 s), twice, both on the first page load of a fresh browser process after idle (3.98 s; every resource < 310 ms). Probes: forced CDN edge misses 0.8–1.3 s; first load per process 2–5.7 s, later loads 0.8–0.9 s → client cold start, not the site. Fix: throwaway-context browser warm-up before check 0 (fresh context, empty cache) + navigation timing printed on failure. 5/5 Netlify runs pass right after a deploy, check 0 811–908 ms.
- `persistence_compare` (same 307 machines, Jan–Apr rankings, May–Jun outcomes, Fisher/Wilson 90% CIs, paired bootstrap Δρ over machines):
  - vs May–Jun shrunk effect: manager ρ 0.05 [−0.05, 0.14], P@10 0% [0%, 21%]; ours ρ 0.58 [0.51, 0.64], P@10 40% [19%, 65%]; Δρ +0.53 [+0.41, +0.64].
  - vs May–Jun raw house win: manager ρ 0.67 [0.62, 0.72], P@10 40%; ours ρ −0.01 [−0.10, 0.08], P@10 0%; Δρ −0.68 [−0.80, −0.56].
  - Jan–Apr house win vs spot's expected coin-in ρ 0.61 (vs our effect 0.10): low house win persists because the spot persists.
- Model Lab: dot-and-whisker tile (`#ranking-compare`) titled from the result, table toggle, honest "each ranking predicts its own yardstick" note. Verdict: "on our list"/"not on our list" tag per manager row; zero-overlap subtitle copy. New leakage test (28/28 pass), ruff clean.
- Next: M7.

## M7 · Floor map hero — done (~0.75 h; most of the map shipped in M6.5)
- Color-by toggle now Verdict / Machine effect / House win (period quintiles) / Downtime (theo lost, sqrt scale); legend ramp + min/max per metric, shape = verdict always.
- Month scrubber (`data-testid=time-scrubber`): click, ←/→, play walks Jan→Jun at 1.4 s/step; writes the global period so every screen follows. Glyphs translate with a 700 ms transition, so machines that moved spots glide to the new one (off under reduced motion).
- Bank click → global filter with Undo toast and machine → waterfall drawer unchanged from M6.5. Judge 0–4/9 PASS locally (check 2: bank drill changes Verdict).
- Next: M8.

## M8 · Competing explanations + move test — done
- Approved claim (verbatim, Model Lab subtitle; reuse in claims appendix + write-up): "The manager's ranking is consistent, but it tracks the spot, not the machine. Jan–Apr house win follows the spot's expected play (ρ 0.61), not machine effect (ρ 0.10). Our ranking is the one that predicts which machines underperform their spot (ρ 0.58 vs. 0.05)." ρ 0.61/0.10 now computed in run_all (`persistence_compare.train_house_win_rho`).
- Moved machines (4 moves, ≥14 d each side): β model 0.90 [0.44, 1.07], peers 1.23 [0.10, 1.38] → inconclusive. Without M-1152 (Z-B40→Z-ENT, the one informative move): 0.77 / 0.52.
- **Disclosure:** the 0.5 decision threshold was set after seeing the estimates; not pre-registered. Stated in the tile; must also appear in the M12 claims appendix.
- Carded share: manager's 10 +0.2 pp [−0.5, +0.8] vs rest (no gap). Volatility: 4/10 high vs floor 35%, Fisher one-sided p 0.48.
- Move test (A-MOVE-MACHINE): 3 swaps / 6 moves, $10.8k, matched same-bank controls, planned 90% CI ±0.12. Theo $1.8k/$3.4k/$3.9k + VOI $9.2k (prior sd sensitivity $2.6k–$19.7k) = $12.6k vs REPLACE-LEASE $33.8k at $2.0k → included, replaces REPLACE-LEASE. Plan: INSPECT + WAYFINDING + MOVE = $19.5k.
- Follow-on: replacing 36 quiet-spot weak machines is −$98k at β 0.9, +$85k at β 0. VOI counted $0 for other lines [assumption].
- UI: Model Lab "Does performance follow the spot?" section; Verdict softened line; drawer carded share vs floor + move history; Plan choice tile with sizing table. Tests 34 pass; judge PASS.
- Next: pause for M8.5.
