# Results summary

*Synthetic data, fictional Gilded Ace casino, Jan–Jun 2025.*

- **[Insight]** 7 of the manager's 10 lowest-earning machines earn less for reasons a replacement won't fix: payback setting, a quiet spot, one payout to verify (M-1158) or no clear problem. The manager's ranking tracks the spot (ρ 0.61), not the machine (ρ 0.10).
- **[Rigor / validation]** Model 1 is fit on Jan–Apr only. On unseen May–Jun data its errors are 20% smaller than a zone × weekday baseline (MAE $890 vs. $1,106 per machine-day). Our Jan–Apr machine ranking predicts May–Jun at ρ 0.58 [0.51, 0.64], against 0.05 for the manager's. Every alternative explanation we tested is in a 17-claim appendix.
- **[Actionable recommendation]** Spend $19.5k of the $100k (inspect M-1158, signage in Back Forty, a 6-machine move test) for an expected $19.4k of theo ($7.1k–$36.0k) in 30 days. Keep $80.5k until the 30-day re-rank. Each action has its own measure, and the plan holds in 19 of 21 what-if scenarios.
- **[Storytelling / design]** Five chapters, each answering one question. Each one opens on a single headline, and every machine has a case file ending in "The call".
- **[Reproducibility]** `python run.py all` rebuilds every number, and SHA-256 fingerprints of 25 inputs and 29 outputs must match (`/evidence#reproduce`). Tests include leakage checks, and the build runs Playwright judge checks.
