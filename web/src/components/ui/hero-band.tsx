import { createContext, useContext, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "../../lib/cn";
import { navFor } from "../shell/nav";
import { ChapterHeader, SectionHeader } from "../shell/Chapter";
import { CardIndex, DecoRule } from "../theme/Deco";

/**
 * Inside a chapter, an embedded screen's HeroBand becomes either the chapter header (`lead`: its data-driven
 * assertion is the headline) or a section header (short `title` + "Answers Qn"; the assertion is the sentence).
 */
type Part = { lead?: boolean; id?: string; title?: string; answers?: string };
const PartCtx = createContext<Part | null>(null);
export function ChapterPart({ children, ...p }: Part & { children: ReactNode }) {
  return <PartCtx.Provider value={p}>{children}</PartCtx.Provider>;
}

/** Screen header: maroon spotlight, card-index eyebrow, Bodoni assertion title, subtitle, KPI strip, deco rule. */
export function HeroBand({
  eyebrow,
  title,
  sub,
  children,
  className,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const card = navFor(useLocation().pathname)?.card;
  const part = useContext(PartCtx);
  if (part?.lead)
    return (
      <ChapterHeader title={title} sentence={sub}>
        {children && <div className="mt-10">{children}</div>}
      </ChapterHeader>
    );
  if (part)
    return (
      <SectionHeader id={part.id} title={part.title ?? title} answers={part.answers} sentence={part.title ? title : sub}>
        {children}
      </SectionHeader>
    );
  return (
    <header className={cn("relative isolate", className)}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="spotlight absolute -left-24 -top-40 h-[420px] w-[620px]" />
      </div>
      <div className="relative px-6 pb-10 pt-[72px] md:px-10">
        <p className="label-sc flex items-center gap-2">
          {card && (
            <>
              <CardIndex card={card} className="text-sm" />
              <span aria-hidden>·</span>
            </>
          )}
          <span>{eyebrow}</span>
        </p>
        <h1
          className="serif mt-4 max-w-[24ch] text-3xl font-medium leading-[1.08] tracking-[-0.01em] text-fg md:text-[46px]"
          data-testid="assertion-title"
        >
          {title}
        </h1>
        {sub && <p className="mt-4 max-w-prose text-lg text-fg-muted">{sub}</p>}
        {children && <div className="mt-10">{children}</div>}
      </div>
      <DecoRule className="mx-6 md:mx-10" />
    </header>
  );
}

/** KPI strip: hero numbers separated by vertical hairlines, not boxed. */
export function KpiStrip({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <dl className="grid grid-cols-2 gap-y-6 lg:flex lg:divide-x lg:divide-divider" data-testid={testId}>
      {children}
    </dl>
  );
}

export function Kpi({
  label,
  value,
  unit,
  note,
  delta,
  footer,
  focal = false,
  testId,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  delta?: ReactNode;
  footer?: ReactNode;
  focal?: boolean;
  testId?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 pr-6 lg:px-8 lg:first:pl-0" data-testid={testId}>
      <dt className="eyebrow">{label}</dt>
      <dd
        className={cn(
          "serif flex items-baseline gap-1.5 text-3xl font-medium tabular-nums lg:text-[32px]",
          // Gold is kept for the chapter headline; a focal KPI is marked by weight, not color.
          focal ? "font-semibold text-fg" : "text-fg",
        )}
        data-kpi-value
      >
        {value}
        {unit && <span className="text-xl font-medium text-fg-muted">{unit}</span>}
      </dd>
      {delta && <dd>{delta}</dd>}
      {note && <dd className="max-w-[30ch] text-xs text-fg-muted">{note}</dd>}
      {footer && <dd className="pt-0.5">{footer}</dd>}
    </div>
  );
}
