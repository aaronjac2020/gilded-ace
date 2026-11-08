# The Gilded Ace: don't cut the bottom ten

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
