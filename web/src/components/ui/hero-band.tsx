import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

function Plus({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 11 11" className={cn("absolute h-[11px] w-[11px] text-fg-subtle", className)} aria-hidden>
      <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** Screen header: grid backdrop + maroon spotlight + plus marks, eyebrow, assertion title, subtitle, KPI strip. */
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
  return (
    <header className={cn("relative isolate", className)}>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="grid-backdrop absolute inset-0" />
        <div className="spotlight absolute -left-24 -top-40 h-[420px] w-[620px]" />
      </div>
      <div className="relative px-6 pb-8 pt-10 md:px-10">
        <Plus className="left-[14px] top-[14px] hidden md:block" />
        <Plus className="right-[14px] top-[14px] hidden md:block" />
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="display mt-3 max-w-[22ch] text-3xl text-fg md:text-4xl" data-testid="assertion-title">
          {title}
        </h1>
        {sub && <p className="mt-3 max-w-prose text-lg text-fg-muted">{sub}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
      <div className="hairline-dashed mx-6 md:mx-10" aria-hidden />
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
      <dd className={cn("display flex items-baseline gap-1.5 text-3xl lg:text-4xl", focal ? "text-gold-soft" : "text-fg")} data-kpi-value>
        {value}
        {unit && <span className="text-xl font-medium text-fg-muted lg:text-2xl">{unit}</span>}
      </dd>
      {delta && <dd>{delta}</dd>}
      {note && <dd className="max-w-[30ch] text-xs text-fg-muted">{note}</dd>}
      {footer && <dd className="pt-0.5">{footer}</dd>}
    </div>
  );
}
