import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  note,
  evidence,
  hero = false,
  testId,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  evidence?: ReactNode;
  hero?: boolean;
  testId?: string;
}) {
  return (
    <div className={`card flex flex-col gap-1 p-4 ${hero ? "shadow-glow" : ""}`} data-testid={testId}>
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="font-display text-3xl font-semibold tabular-nums text-ink" data-kpi-value>
        {value}
      </p>
      {note && <p className="text-xs text-muted">{note}</p>}
      {evidence && <div className="mt-auto pt-1">{evidence}</div>}
    </div>
  );
}
