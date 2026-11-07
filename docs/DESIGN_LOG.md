# Design log — M8.5 Casino polish

Goal: keep the M6.5 system (Inter/JetBrains, OKLCH tokens, bento tiles, list rows) and add a casino identity:
maroon felt, brushed gold, ivory cards, near-black lacquer, small-caps mono labels. Luxurious, not kitsch.
Not building: boot screens, logs, terminal styling, LED dots, pixel/neon/CRT, marquee bulbs, sound, mascots, slot art.

## Round 0 — baseline (outputs/figures/ui_v6/r0/)

- Verdict: strong hero type, but generic dark-SaaS; subtitle runs 4 lines (rule: ≤18 words); the
  game-setting chip pushes manager-row metrics past the tile edge at 1440; gold spent on a KPI, not the claim.
- Floor: 3-line title, 5 flat KPIs; map starts below the fold at 1280.
- Model Lab: 3-line title; 3 panels per row at 1440 (rule: ≤2); hero number gold but not the persistence ρ.
- Everywhere: grid backdrop + plus marks read "dev tool"; dashed hairline divider; tile labels are sans eyebrows.
- Status-pill dots are close to "LED dots" — keep the pill, drop the glow, consider dropping the dot.

## Round 1 plan
- Theme kit: felt / rail / brushed gold / ivory tokens; PlayingCard, Chip(Stack), VerdictStamp, DecoRule,
  DecoCorner, DealerButton, GoldNumber, CardShuffle (components/theme/).
- Shared: card index in every eyebrow, 32px panel title bars (mono small caps, gold 25% hairline), shuffle loader
  ≥300ms, chip-icon toasts, 404 "This card isn't in the deck", DealerButton tour counter.
- Verdict Reveal (felt table, dealt + flipped manager's 10, gold Bodoni count, Our call rows, List view toggle).
- Case file drawer with "The call" tab.
- Less-cramped pass: 1180px max, 72px hero top, 28px panel padding, 64px section gaps, ≤2 panels/row.

## Round 1 — shipped (outputs/figures/ui_v6/r1, r1b after fixes)
- Theme kit + shared details as planned; Verdict Reveal (felt rail, 10 dealt/flipped cards, gold "7 of 10",
  List view keeps manager-list testid); case file drawer with "The call" first, numbered evidence with leaders.
- Spacing: section gaps 64px / gap-8; Model Lab ≤2 panels per row; persistence ρ is the gold focal.
- Critic #1 (Cl/Br/Ta/Co/Me/Ba): Verdict 9/7/8/8/9/7 · Case file 8/6/6/6/6/5 · Floor 6/6/7/7/6/5 ·
  Plan 7/5/6/7/6/5 · Model 6/6/5/6/5/6 · placeholders 4/7/6/6/3/4.
- Fixed now: shorter cards (5:6), legible 10px stamps/hold tag, pip clearance, "Show the math" docked in the
  frame; case file leads with the call, evidence links muted (gold kept for the call); placeholder screens drop
  internal milestone names → one numbered "planned evidence" panel; Model timeline validate block as maroon
  outline, readable dates.
- Deferred to Round 2 (its scope): Plan 3-per-row → betting table; Floor 5 KPIs → 3 + gold, map above fold,
  clipped zone label, off-palette dots; top-bar density.
- Kept against critic: verdict hues (inspect = violet) are the app-wide verdict encoding, not decoration.
- Judge check 0 flaked once (3.7s) on the first cold serve after a rebuild; 2 reruns 0.8s / 0.6s.

## Round 2 — shipped (outputs/figures/ui_v6/r2, r2b after fixes)
- Plan betting table: chip stacks on 3 spots + Held (height ∝ cost, $4k/chip), arc in on first view, hover/focus
  shows qty · targets · theo range · formula; totals line when idle. Line tiles 2 per row.
- Floor: verdict-colored lamp glow on non-ok marks, gold halo on the selected machine, ivory K♠ legend card,
  gold rail scrubber with a chip playhead; KPIs 5 → 3; felt map frame.
- Header: ‹ ▶ › playback (1.5 s/month via URL period, off by default; Space · , · .), dealer puck on the active
  month, ON FLOOR / THEO / LOST TO DOWNTIME readouts (NumberFlow) from 1360px.
- Verdict "Month · what changed": ≤3 lines per month from month_highlights.json (0.7 KB, export_web), cross-fade,
  aria-live off while playing.
- Model Lab: double gold frame on manager-vs-ours, gold diamond pips on the leakage checklist.
- Critic #2: Verdict 9/9/8/7/9/8 · Case file 8/6/7/6/6/6 · Floor 7/7/7/6/7/6 · Plan 8/8/7/6/8/6 ·
  Model 7/6/6/6/5/5 · stubs 4/6/7/4/2/3.
- Applied (top 3 by impact/effort, #2 swapped): top-bar nowrap + readouts from 1360px (fixes wrap at 1280);
  stub screens → felt panel with planned exhibits dealt face down; betting labels on one baseline + gold rim
  on the Held stack.
- Kept against critic (again): inspect = violet. It is the verdict encoding on every screen; gold is taken by
  location. [deviation] readouts show from 1360px, not 1280px, to stop top-bar wrapping at 1280.
- Squint: Verdict = card grid; Plan = chip table below the fold, gold Spend above; stubs = felt panel. Floor and
  Model still split focus (gold KPI vs. hero visual) — next pass.

## Round 3 / final (outputs/figures/ui_v6/r3, final + reveal.webm)
- Floor + Plan: KPI strips moved below the hero visual (testids unchanged) so the map and the chip table sit
  above the fold; gold "62" on Floor; map fits with top padding (no clipped labels).
- Case file: lacquer drawer with gold edge; "What we'd do / What would change the call" per verdict.
- Model: Test band ivory (one gold accent = persistence ρ); Validate maroon outline. KPI numerals → Bodoni.
- Bug: sidebar active state applied to every item — Radix Slot (Tip asChild) stringified NavLink's function
  className. Now computed from the pathname; active = maroon + gold bar + gold text.
- Inspect caveat 8 → 9px semibold.
- Critic #3 (before these fixes): Verdict 9/9/8/8/9/8 · Case file 8/6/8/7/7/6 · Floor 7/8/7/6/8/6 ·
  Plan 8/8/7/7/8/6 · Model 7/6/7/7/5/7 · stubs 8/9/8/8/6/8.
