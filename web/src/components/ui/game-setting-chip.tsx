import { fmt } from "../../lib/format";

/** Named explanation: the game is configured to pay back more, so the same play earns less house win. Game math, not a gap. */
export function GameSettingChip({ hold, median }: { hold: number; median: number }) {
  return (
    <span
      className="rounded-sm border border-divider px-1.5 py-0.5 text-2xs text-fg-muted"
      title={`Configured hold ${fmt.pct(hold)} vs. floor median ${fmt.pct(median, 0)}: the same play earns less house win.`}
      data-testid="chip-game-setting"
    >
      Game setting: pays back more by design
    </span>
  );
}
