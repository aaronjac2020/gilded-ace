import type { ReactNode } from "react";
import { HeroBand } from "./ui/hero-band";

/** Honest placeholder for a screen whose analysis lands in a later milestone. */
export function Pending({ eyebrow, question, milestone, plan }: { eyebrow: string; question: ReactNode; milestone: string; plan: string[] }) {
  return (
    <div>
      <HeroBand className="-mx-6" eyebrow={eyebrow} title={question} sub={`This analysis lands in ${milestone}. The question and the planned evidence are below.`} />
      <div className="mt-8 grid grid-cols-12 gap-6">
        {plan.map((p) => (
          <div key={p} className="col-span-12 flex h-40 items-end rounded-lg p-5 ring-1 ring-inset ring-ring [background:repeating-linear-gradient(135deg,transparent_0_8px,rgb(255_255_255/0.015)_8px_9px)] md:col-span-6 lg:col-span-4">
            <div>
              <p className="eyebrow">Planned</p>
              <p className="mt-1 text-sm text-fg-muted">{p}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
