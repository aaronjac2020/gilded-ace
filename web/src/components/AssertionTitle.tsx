import type { ReactNode } from "react";

/** Screen title phrased as a data-driven assertion; kicker names the screen. */
export function AssertionTitle({ kicker, children, sub }: { kicker: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">{kicker}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold leading-tight text-ink md:text-4xl" data-testid="assertion-title">
        {children}
      </h1>
      {sub && <p className="mt-2 max-w-3xl text-sm text-muted">{sub}</p>}
    </header>
  );
}
