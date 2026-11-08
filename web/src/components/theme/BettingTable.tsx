import { m, useInView, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import { fmt } from "../../lib/format";
import { cn } from "../../lib/cn";
import { ChipStack, type ChipTone } from "./Chip";
import { DecoCorner } from "./Deco";

export type Bet = {
  id: string;
  name: string;
  cost: number;
  quantity?: number;
  targets?: string;
  lo?: number;
  mid?: number;
  hi?: number;
};

const TONES: ChipTone[] = ["maroon", "ivory", "lacquer"];

/**
 * The plan as bets on felt: one chip stack per action (height ∝ cost) plus the held stack.
 * Stacks arc in from the dealer's side the first time the table scrolls into view; hover or focus a spot for its math.
 */
export function BettingTable({
  bets,
  held,
  formula,
  total,
}: {
  bets: Bet[];
  held: number;
  formula: string;
  total: { lo: number; mid: number; hi: number };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const spots = [
    ...bets.map((b, i) => ({ ...b, tone: TONES[i % TONES.length] })),
    { id: "held", name: "Kept in reserve", cost: held, tone: "lacquer" as ChipTone },
  ];
  const cur = spots.find((s) => s.id === active) ?? null;
  const spend = bets.reduce((a, b) => a + b.cost, 0);

  return (
    <div ref={ref} className="felt rail relative px-6 pb-6 pt-6 md:px-10" data-testid="betting-table">
      <DecoCorner at="tl" />
      <DecoCorner at="tr" />
      <DecoCorner at="bl" />
      <DecoCorner at="br" />
      <p className="label-sc px-2 text-[#E3B36A]">The bets · {fmt.usdK(spend + held)} on the table</p>
      <ul className="mt-6 flex flex-wrap items-start justify-around gap-x-6 gap-y-8 px-2" aria-label="Plan spend by action">
        {spots.map((s, i) => {
          const maxCost = Math.max(...spots.map((x) => x.cost));
          const n = Math.max(1, Math.round((s.cost / maxCost) * 22));
          return (
            <li key={s.id} className="flex w-[176px] flex-col items-center">
              <button
                type="button"
                onMouseEnter={() => setActive(s.id)}
                onFocus={() => setActive(s.id)}
                onClick={() => setActive(s.id)}
                aria-pressed={active === s.id}
                aria-label={`${s.name}: ${fmt.usd(s.cost)}`}
                className={cn(
                  "focus-ring relative flex h-[150px] w-[112px] items-end justify-center rounded-full pb-6",
                  "after:pointer-events-none after:absolute after:inset-x-0 after:bottom-2 after:h-12 after:rounded-[50%] after:border after:border-ivory/25 after:transition-colors",
                  active === s.id && "after:border-ivory",
                  s.id === "held" && "after:border-dashed",
                )}
              >
                <m.span
                  className="relative z-10 block"
                  initial={reduce ? false : { opacity: 0, x: 160, y: -120 }}
                  animate={seen || reduce ? { opacity: 1, x: 0, y: [-120, -150, 0] } : undefined}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                >
                  <ChipStack
                    n={Math.min(n, 22)}
                    tone={s.tone}
                    width={48}
                    className={s.id === "held" ? "drop-shadow-[0_0_2px_oklch(var(--ivory))]" : undefined}
                  />
                </m.span>
              </button>
              <p className="mt-1 line-clamp-3 h-[60px] text-center text-sm leading-5 text-ivory" title={s.name}>
                {s.name}
              </p>
              <p className="mono text-xs text-[#E3B36A]">{fmt.usdK(s.cost)}</p>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 min-h-[44px] border-t border-ivory/20 px-2 pt-4 text-xs text-[#E9DCCB]" aria-live="polite">
        {cur && cur.id !== "held" && "quantity" in cur ? (
          <p>
            <span className="text-ivory">{cur.name}</span> · qty <span className="mono text-ivory">{cur.quantity}</span> · {cur.targets} ·
            expected added theo{" "}
            <span className="mono text-ivory">
              {fmt.usdK(cur.lo)}–{fmt.usdK(cur.hi)}
            </span>{" "}
            (mid {fmt.usdK(cur.mid)}) · <span className="mono">{formula}</span>
          </p>
        ) : cur ? (
          <p>
            <span className="text-ivory">Kept in reserve</span> · {fmt.usdK(cur.cost)} not spent. Keeping budget is a valid call when
            evidence is thin.
          </p>
        ) : (
          <p>
            Spend <span className="mono text-ivory">{fmt.usdK(spend)}</span> · kept{" "}
            <span className="mono text-ivory">{fmt.usdK(held)}</span> · expected added theo{" "}
            <span className="mono text-ivory">{fmt.usdK(total.mid)}</span> ({fmt.usdK(total.lo)}–{fmt.usdK(total.hi)}). Hover a stack for
            its math.
          </p>
        )}
      </div>
    </div>
  );
}
