import type { ReactNode } from "react";
import { DecoCorner } from "./theme/Deco";
import { HeroBand } from "./ui/hero-band";

/** Honest placeholder for a screen whose analysis is still being built: the planned exhibits, dealt face down. */
export function Pending({ eyebrow, question, plan }: { eyebrow: string; question: ReactNode; milestone?: string; plan: string[] }) {
  return (
    <div>
      <HeroBand className="-mx-6" eyebrow={eyebrow} title={question} sub="In progress. The exhibits planned for this question:" />
      <section aria-label="Planned exhibits" className="felt rail relative mt-16 px-6 pb-8 pt-6 md:px-10">
        <DecoCorner at="tl" />
        <DecoCorner at="tr" />
        <DecoCorner at="bl" />
        <DecoCorner at="br" />
        <div className="flex items-center justify-between gap-4 px-2">
          <p className="label-sc text-gold-soft/80">Planned exhibits · {plan.length} to deal</p>
          <span className="label-sc rounded-full px-2.5 py-1 text-[10px] text-gold ring-1 ring-inset ring-gold/50">In progress</span>
        </div>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {plan.map((p, i) => (
            <li key={p} className="flex flex-col items-center text-center">
              <div
                className="card-back aspect-[5/7] w-full max-w-[150px] rounded-lg"
                style={{ rotate: `${(i - (plan.length - 1) / 2) * 2}deg` }}
                aria-hidden
              />
              <p className="mt-6 flex max-w-[26ch] items-baseline gap-2 text-sm text-fg">
                <span className="serif shrink-0 text-gold-soft">{i + 1}</span>
                {p}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
