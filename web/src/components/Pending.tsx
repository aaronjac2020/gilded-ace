import type { ReactNode } from "react";
import { HeroBand } from "./ui/hero-band";

/** Honest placeholder for a screen whose analysis is still being built: the question and the planned evidence. */
export function Pending({ eyebrow, question, plan }: { eyebrow: string; question: ReactNode; milestone?: string; plan: string[] }) {
  return (
    <div>
      <HeroBand className="-mx-6" eyebrow={eyebrow} title={question} sub="In progress. The evidence planned for this question:" />
      <ol className="mt-12 max-w-prose divide-y divide-divider rounded-lg bg-surface-1 px-7 ring-1 ring-inset ring-gold/15">
        {plan.map((p, i) => (
          <li key={p} className="flex items-baseline gap-4 py-4 text-sm text-fg-muted">
            <span className="serif w-4 shrink-0 text-gold-soft">{i + 1}</span>
            {p}
          </li>
        ))}
      </ol>
    </div>
  );
}
