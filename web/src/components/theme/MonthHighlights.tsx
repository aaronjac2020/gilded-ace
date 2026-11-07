import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { PERIOD_LABELS } from "../shell/TopBar";
import { usePlaying } from "../../lib/uiStore";
import { useJson } from "../../lib/useData";
import { DecoRule } from "./Deco";

type Highlights = { months: Record<string, string[]> };

/** "Month · what changed": up to 3 neutral lines per month. Cross-fades on change; announced only on manual steps. */
export function MonthHighlights({ period }: { period: string }) {
  const data = useJson<Highlights>("month_highlights.json").data;
  const playing = usePlaying();
  const reduce = useReducedMotion();
  const lines = data?.months[period];
  if (!lines?.length) return null;
  return (
    <section className="mt-10" aria-label="What changed this month" data-testid="month-highlights">
      <DecoRule />
      <div className="mt-4 flex flex-wrap items-baseline gap-x-8 gap-y-2" aria-live={playing ? "off" : "polite"} aria-atomic>
        <p className="label-sc shrink-0 text-gold-soft/80">{PERIOD_LABELS[period] ?? period} · what changed</p>
        <AnimatePresence mode="wait" initial={false}>
          <m.ul
            key={period}
            className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-fg"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {lines.slice(0, 3).map((l) => (
              <li key={l} className="flex items-baseline gap-2">
                <span aria-hidden className="text-[8px] text-gold">
                  ◆
                </span>
                {l}
              </li>
            ))}
          </m.ul>
        </AnimatePresence>
      </div>
    </section>
  );
}
