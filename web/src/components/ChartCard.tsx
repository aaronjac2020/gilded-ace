import { BarChart3, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";

/** Card wrapping a chart with a "Show as table" text alternative. */
export function ChartCard({
  id,
  title,
  subtitle,
  table,
  children,
  className = "",
}: {
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  table?: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section id={id} className={`card p-4 ${className}`} aria-label={typeof title === "string" ? title : undefined}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {table && (
          <button type="button" onClick={() => setAsTable((v) => !v)} className="btn-ghost shrink-0" aria-pressed={asTable}>
            {asTable ? <BarChart3 size={14} aria-hidden /> : <Table2 size={14} aria-hidden />}
            {asTable ? "Show chart" : "Show as table"}
          </button>
        )}
      </div>
      {asTable && table ? (
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="sticky top-0 bg-surface text-muted">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} className="px-2 py-1 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-t border-rule">
                  {r.map((v, j) => (
                    <td key={j} className="px-2 py-1">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
