# Claims appendix — draft (feeds M12 claims.json)

Each claim ships with an EvidenceLink. Numbers regenerate from outputs/metrics.json.

1. **Manager's ranking tracks the spot** (approved, verbatim): "The manager's ranking is consistent, but it tracks the spot, not the machine. Jan–Apr house win follows the spot's expected play (ρ 0.61), not machine effect (ρ 0.10). Our ranking is the one that predicts which machines underperform their spot (ρ 0.58 vs. 0.05)." — `persistence_compare` → /model?focus=ranking-compare
2. **Does play follow the spot?** Probably, but only 4 machines moved: pooled slope 0.90 [0.44, 1.07] (model), 1.23 [0.10, 1.38] (bank peers). Without M-1152: 0.77 / 0.52. The 0.5 decision threshold was set after seeing these estimates, so it is not pre-registered. — `alternatives.moved` → /model?focus=ranking-compare
3. **Game setting: pays back more by design.** 5 of the manager's 10 are configured at 5% expected hold, the floor's lowest setting (25 of 310 machines floor-wide; floor median 10%; hypergeometric p = 0.0004). At the median setting the same play would carry about 2× the theo ($240k vs. $120k). This is game math: expected hold is set by the paytable, and observed hold matches it. — `low_hold` → /verdict
4. **Move test sizing.** 3 swaps / 6 moves ($10.8k): planned 90% interval on the slope ±0.14, simulated from same-bank play over 16 operating days, with machine-to-machine variation fitted to the observed moves (±0.29 if fitted to the peer interval). — `move_test.power` → /plan
