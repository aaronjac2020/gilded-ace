import { LayoutGrid, List, RotateCcw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { ScoreRow } from "../../lib/data";
import { fmt } from "../../lib/format";
import { cn } from "../../lib/cn";
import { verdictLabels } from "../../theme/tokens";
import { Button } from "../ui/button";
import { DecoCorner } from "./Deco";
import { PlayingCard } from "./PlayingCard";
import { VerdictStamp } from "./VerdictStamp";

const STAGGER = 0.06;

/**
 * Verdict Reveal: the manager's list dealt face-down onto the felt (60ms stagger), then flipped to show ID,
 * house win and verdict stamp. Cards are buttons from the first frame. "List view" swaps in the row list.
 */
export function RevealTable({
  rows,
  ours,
  lowHold,
  onOpen,
  list,
  caption,
}: {
  rows: ScoreRow[];
  ours: Set<string>;
  lowHold: (r: ScoreRow) => boolean;
  onOpen: (id: string) => void;
  list: ReactNode;
  caption?: ReactNode;
}) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [deal, setDeal] = useState(0);
  const [up, setUp] = useState(false);
  useEffect(() => {
    setUp(false);
    const t = setTimeout(() => setUp(true), 30);
    return () => clearTimeout(t);
  }, [deal]);
  const n = rows.length;

  return (
    <div className="rail relative px-6 pb-6 pt-5 md:px-8" data-testid="reveal-table">
      <DecoCorner at="tl" />
      <DecoCorner at="tr" />
      <DecoCorner at="bl" />
      <DecoCorner at="br" />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-2">
        <p className="label-sc text-gold-soft/80">Manager&rsquo;s cut list · bottom {n} by house win</p>
        <div className="flex items-center gap-1">
          {view === "cards" && (
            <Button variant="ghost" size="sm" onClick={() => setDeal((d) => d + 1)}>
              <RotateCcw size={14} aria-hidden /> Replay deal
            </Button>
          )}
          <div role="group" aria-label="View" className="flex rounded-sm bg-black/30 p-0.5 ring-1 ring-inset ring-gold/15">
            {(
              [
                ["cards", "Cards", LayoutGrid],
                ["list", "List view", List],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "focus-ring flex h-7 items-center gap-1.5 rounded-[5px] px-2 text-xs transition-colors duration-hover",
                  view === v ? "bg-white/10 text-ivory" : "text-fg-muted hover:text-fg",
                )}
              >
                <Icon size={13} aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "list" ? (
        <div className="rounded-lg bg-black/25 p-4">{list}</div>
      ) : (
        <ol
          key={deal}
          className="mx-auto grid max-w-[720px] grid-cols-5 justify-items-center gap-x-3 gap-y-5 px-1 min-[1600px]:max-w-none min-[1600px]:grid-cols-10"
          aria-label="Manager's bottom 10, as cards"
          data-testid="manager-list"
        >
          {rows.map((r, i) => (
            <li key={r.machine_id} className="w-full max-w-[124px]">
              <button
                type="button"
                onClick={() => onOpen(r.machine_id)}
                className="focus-ring group block w-full rounded-[10px] text-left"
                aria-label={`${r.machine_id}, house win ${fmt.usdK(r.house_win_usd)}, ${verdictLabels[r.verdict]}${lowHold(r) ? ", game setting pays back more by design" : ""}${ours.has(r.machine_id) ? ", on our list" : ", not on our list"}`}
                data-machine-row={r.machine_id}
              >
                <PlayingCard
                  deal
                  delay={i * STAGGER}
                  faceUp={up}
                  flipDelay={n * STAGGER + 0.25 + i * STAGGER}
                  suit="♠"
                  className="aspect-[5/6] w-full transition-transform duration-hover ease-out group-hover:-translate-y-1"
                >
                  <div className="flex h-full flex-col items-center px-2 pb-5 pt-4 text-center">
                    <span className="font-mono text-[12px] font-semibold tracking-tight">{r.machine_id}</span>
                    <span className="serif mt-2 text-[20px] font-semibold leading-none">{fmt.usdK(r.house_win_usd)}</span>
                    <span className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ink/70">house win</span>
                    {lowHold(r) && (
                      <span className="absolute right-1.5 top-1 font-mono text-[10.5px] font-semibold text-[#5c5350]" title="Game setting">
                        {fmt.pct(r.hold_expected, 0)}
                      </span>
                    )}
                    <VerdictStamp verdict={r.verdict} size="sm" className="mt-auto" />
                  </div>
                </PlayingCard>
                {!ours.has(r.machine_id) && (
                  <span className="sr-only" data-testid="not-ours">
                    not on our list
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
      {caption && <div className="mt-5 px-2 text-xs text-fg-muted">{caption}</div>}
    </div>
  );
}
