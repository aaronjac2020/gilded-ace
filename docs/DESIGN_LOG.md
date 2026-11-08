# Design log (M12.5 story redesign)

## Round 0 · baseline cold-viewer test (2026-11-07)
Screenshots: outputs/figures/redesign/r0/ (10 routes, 1440×900). Subagent saw only the screenshots.

1. **Purpose:** an analytics review of a casino slot floor ("Gilded Ace", synthetic data) that tests the manager's 10 lowest earners and also covers demand, downtime, players, comps and a $100k plan.
2. **Finding:** "7 of 10 aren't the problem". The viewer read the mix as 4 location / 3 truly weak / 2 OK / 1 inspect, and found the spot-not-machine line only on Methodology.
3. **Recommendation:** spend $19.5k on inspection ($1.2k), signage ($7.5k) and a move ($10.8k); hold $80.5k.
4. **Validation:** found the train Jan–Mar / tune Apr / test May–Jun split, "19.5% lower error than baseline", Spearman 0.58 with a CI, and the 17 claims.
5. **Top confusions:**
   - "5%" appears without explanation, and "5 of 10 pay back more" seems to conflict with "7 of 10".
   - Jargon is undefined: theo, hold, WMAPE, Spearman.
   - It isn't clear how 4+3+2+1 adds up to 7.
   - The "Held" chip is unexplained.
   - The floor map is dense, and the top-bar readouts are unexplained.

**Baseline scores:**

| Intuitive | Clutter | Readable | Theme | Rubric |
|---|---|---|---|---|
| 6 | 6 | 6 | 9 | 8 |
