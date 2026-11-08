# Devpost submission (copy-paste)

## Project title
The Gilded Ace: Don't Cut the Bottom Ten

## Tagline
7 of the 10 machines on the cut list aren't the problem. Here's what to do with $100k instead.

## Dashboard URL
DASHBOARD_URL_HERE

## Video URL
VIDEO_URL_HERE

## Links
- Code: https://github.com/aaronjac2020/gilded-ace
- Claims appendix (17 claims, each with its query, alternative tested and limit): https://github.com/aaronjac2020/gilded-ace/blob/main/docs/claims_appendix.md
- AI disclosure: https://github.com/aaronjac2020/gilded-ace/blob/main/docs/ai_disclosure.md

## About the project (write-up)
*Synthetic data for a fictional casino, Jan–Jun 2025. Nothing here describes a real property.*

## Problem

The general manager wants to replace the 10 machines with the lowest house win. House win mixes the machine, its spot, its payback setting and luck. A replacement fixes only the first.

## Findings

- **The manager's list tracks the spot, not the machine.** House win follows what the spot predicts (ρ 0.61) far more than how the machine itself performs (ρ 0.10).
- **5 of the 10 are set to pay back more.** They keep less of each bet by design (hypergeometric p = 0.0004). 2 of those 5 are also truly weak.
- **Only 3 of the 10 are truly weak**, all milder than our 10 weakest. The rest earn less because of their payback setting, a quiet spot, one payout that needs checking (M-1158, z = −4.6, survives 10% FDR) or no clear problem. So 7 of 10 earn less for reasons a replacement won't fix.
- We also ruled out guest mix (carded share +0.2 pts) and high-risk games (odds ratio 1.26, p = 0.48).

## Model and validation

Model 1 (LightGBM on location, game and calendar, with no machine ID) predicts what each spot should earn. On May–June data it never saw, its errors were 20% smaller than a zone × weekday baseline (MAE $890 vs. $1,106 per machine-day). Machine effects ranked on Jan–Apr predict May–Jun: ours ρ 0.58 [0.51, 0.64] against the manager's 0.05, with precision@10 of 0.40 against 0.03 by chance.

## The $100k plan

| Action | Cost | How it's measured |
|---|---|---|
| Inspect M-1158's paytable | $1.2k | 30-day hold vs. configured |
| New signage in Back Forty (Z-B40) | $7.5k | Zone share, 20 days, difference-in-differences vs. Z-BAR |
| Move-machine test (6 machines) | $10.8k | Play change vs. matched unmoved machines, 16 days |

The plan spends $19.5k for an expected $19.4k of theo ($7.1k–$36.0k) within 30 days. The move test shows whether moves work before any replacement spend. The other **$80.5k is kept**: no replacement passes the rules until the 30-day re-rank. The same plan wins in 19 of 21 what-if scenarios.

## Limitations

- "Play follows the spot" rests on only 4 natural moves; hence the controlled test.
- Its 0.5 slope threshold was set after seeing the data (post hoc); without M-1152 the slopes are 0.77 / 0.52.
- Effects are 30-day estimates.

## How we built it
- **Pipeline (Python):** DuckDB and pandas read the 25 release tables. Model 1 (LightGBM) predicts what each spot should earn, with no machine ID as an input, so a machine's own effect is actual ÷ expected, shrunk by block bootstrap. Model 2 forecasts daily floor coin-in from weekday and events. A change-point split search (with a 5,000-shuffle permutation test) dates the comp shift, and a small exhaustive allocator picks the $100k plan under the rules.
- **Validation:** fit on Jan–Apr, scored on unseen May–Jun. Leakage tests, 50 pytest tests, and every claim checked against an alternative explanation.
- **Dashboard (React + TypeScript + Vite + ECharts):** five chapters plus Evidence, a case file for every machine and period filters. Every number is read from JSON the pipeline exports.
- **Checks:** Playwright judge script, count-consistency between data and DOM, a copy-word budget, Lighthouse, and a SHA-256 reproducibility fingerprint.

## Challenges we ran into
- Separating the machine from its spot. House win mixes the machine, its location, its payback setting and luck, and machines rarely move, so "play follows the spot" rests on only 4 natural moves. We said so and made the plan buy a controlled test.
- Keeping the story honest after redesigns. We froze the numbers and added automated checks so copy couldn't drift from the data.
- Fitting a statistical argument into one headline per chapter without losing the uncertainty.

## What we learned
- A ranking can be perfectly consistent and still measure the wrong thing.
- Holding budget back is a valid recommendation when the evidence is thin, as long as the plan says how it will find out.
- Out-of-sample checks (fit on Jan–Apr, test on May–Jun) persuade more than any in-sample fit.

## Built with
python, duckdb, pandas, numpy, scipy, statsmodels, scikit-learn, lightgbm, pytest, ruff, uv, typescript, react, vite, tailwindcss, echarts, radix-ui, playwright, lighthouse, netlify, claude-code
