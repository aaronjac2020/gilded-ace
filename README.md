# The Gilded Ace: don't cut the bottom ten

The manager of the Gilded Ace wants to replace the 10 slot machines with the lowest house win. This project shows that 7 of those 10 earn less for reasons a replacement won't fix, and recommends how to spend a $100k budget instead.

> All data is synthetic: the Dashboard Royale release `gilded-ace-v1`, v0.9.0-draft, for a fictional casino, Jan–Jun 2025. Nothing here describes a real property.

- **Dashboard:** DASHBOARD_URL_HERE
- **Write-up:** [docs/writeup.md](docs/writeup.md) · **Claims appendix:** [docs/claims_appendix.md](docs/claims_appendix.md) · **AI disclosure:** [docs/ai_disclosure.md](docs/ai_disclosure.md)

## Reproduce (one command)

Needs Python 3.12, Node 24 and `uv`. The data release must be checked out next to this repo at `../dashboard-royale`, or set `DATA_DIR`.

```powershell
git clone https://github.com/aaronjac2020/gilded-ace.git; cd gilded-ace
python run.py setup   # uv venv + requirements.txt, npm ci in web/
python run.py all     # check → pipeline → test → export → fingerprint → build
```

`run.py all` validates the input tables against the release manifest and rebuilds `outputs/*.parquet`, `outputs/metrics.json` and `web/public/data/*.json`. It runs the tests, then writes `outputs/fingerprint.json`: SHA-256 hashes of all 25 inputs and 29 outputs, which it compares with the committed copy and reports as `MATCH` or `MISMATCH`. The same hashes are on the dashboard at `/evidence#reproduce`. To check without overwriting, run `python run.py fingerprint --check`.

Other targets: `python run.py dev` (Vite dev server), `python run.py judge --url <URL>` (Playwright judge checks), `python run.py shots` (screenshots).

## Results

| Finding | Result |
|---|---|
| The manager's 10 that a replacement won't fix | **7 of 10** (payback setting, quiet spot, payout to verify, or no clear problem) |
| What the manager's list tracks | Spot ρ 0.61 vs. machine ρ 0.10 (Jan–Apr) |
| Set to pay back more | 5 of 10, hypergeometric p = 0.0004 |
| Model 1 vs. zone × weekday baseline, May–Jun holdout | MAE $890 vs. $1,106 per machine-day (20% smaller) |
| Ranking persistence, Jan–Apr → May–Jun | Ours ρ 0.58 [0.51, 0.64] vs. manager 0.05; precision@10 0.40 vs. 0.03 by chance |
| Payout to verify | M-1158 held 3.0% vs. 10.0% configured, z = −4.6, survives 10% FDR |
| Comp redemption price | 13.1 → 6.0 points per $ the week of 2025-04-28 (permutation p < 0.001, 5,000 shuffles) |
| $100k plan | Spend $19.5k (inspect M-1158, Back Forty signage, 6-machine move test), keep $80.5k; expected theo $19.4k ($7.1k–$36.0k) in 30 days; same plan in 19 of 21 what-if scenarios |

All 17 claims, each with its query, the alternative tested and its limit, are in [docs/claims_appendix.md](docs/claims_appendix.md) and on `/evidence`.

## Limitations

- "Play follows the spot" rests on only 4 machines that moved. The plan buys a controlled 6-machine test before any replacement.
- The 0.5 slope threshold for that decision was set after seeing the data (post hoc). Without M-1152 the slopes are 0.77 (model) / 0.52 (peer).
- Plan effects are 30-day estimates with wide ranges. The kept $80.5k waits on the 30-day re-rank.
- Synthetic data. The method transfers, but the numbers describe no real casino.

## Layout

| Path | What |
|---|---|
| `pipeline/` | Load, models (LightGBM spot model, daily forecast), verdicts, comps, budget allocator, claims, web export, fingerprint |
| `tests/` | pytest, including `test_no_leakage.py` |
| `outputs/` | Scorecard parquet, metrics, fingerprint, figures (`outputs/figures/final/`) |
| `web/` | Vite + React + TypeScript dashboard; `web/public/data/` is committed so static hosts build without the pipeline |
| `docs/` | Write-up, claims appendix, video script, Devpost text, AI disclosure |

## Deploy (Netlify)

1. app.netlify.com → **Add new site** → **Import from Git** → GitHub → `gilded-ace`.
2. **Base directory:** `web` · **Build command:** `npm run build` · **Publish directory:** `web/dist` · **Node version:** 24 (set `NODE_VERSION=24` under Environment variables).
3. Deploy. `web/public/_redirects` (`/* /index.html 200`) serves client-side routes such as `/floor?bank=B-01`.
4. Check it: `cd web; npm run judge -- --url https://<site>.netlify.app`
