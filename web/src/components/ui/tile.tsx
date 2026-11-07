import * as DM from "@radix-ui/react-dropdown-menu";
import { BarChart3, Download, Link2, MoreHorizontal, Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "../../lib/cn";
import { Button } from "./button";

export type TableData = { columns: string[]; rows: (string | number)[][] };

function downloadCsv(name: string, t: TableData) {
  const esc = (v: string | number) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const csv = [t.columns, ...t.rows].map((r) => r.map(esc).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function copyLink(focus?: string) {
  const u = new URL(window.location.href);
  if (focus) u.searchParams.set("focus", focus);
  navigator.clipboard?.writeText(u.toString()).then(
    () => toast("Link copied", { description: u.pathname + u.search }),
    () => toast("Could not copy link"),
  );
}

const item =
  "flex h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 text-sm text-fg-muted outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg";

/**
 * Bento tile: 11px label, 20px title, content, optional footer. The ⋯ menu offers Show as table,
 * Download CSV and Copy link to this view (every chart has a table alternative).
 */
export function Tile({
  id,
  label,
  title,
  sub,
  table,
  footer,
  actions,
  children,
  className,
  hero = false,
  testId,
}: {
  id?: string;
  label?: string;
  title: ReactNode;
  sub?: ReactNode;
  table?: TableData;
  footer?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  hero?: boolean;
  testId?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section
      id={id}
      className={cn("card flex min-w-0 scroll-mt-20 flex-col p-5", hero && "gradient-ring", className)}
      aria-label={typeof title === "string" ? title : label}
      data-testid={testId}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {label && <p className="eyebrow mb-1">{label}</p>}
          <h2 className="display text-xl text-fg">{title}</h2>
          {sub && <p className="mt-1 text-sm text-fg-muted">{sub}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          {table && (
            <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
              {asTable ? <BarChart3 size={14} aria-hidden /> : <Table2 size={14} aria-hidden />}
              {asTable ? "Show chart" : "Show as table"}
            </Button>
          )}
          <DM.Root>
            <DM.Trigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Tile options">
                <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden />
              </Button>
            </DM.Trigger>
            <DM.Portal>
              <DM.Content align="end" sideOffset={4} className="float z-50 min-w-48 p-1 data-[state=open]:animate-fade-up">
                {table && (
                  <>
                    <DM.Item className={item} onSelect={() => setAsTable((v) => !v)}>
                      <Table2 size={14} aria-hidden /> {asTable ? "Show chart" : "Show as table"}
                    </DM.Item>
                    <DM.Item className={item} onSelect={() => downloadCsv(id ?? "table", table)}>
                      <Download size={14} aria-hidden /> Download CSV
                    </DM.Item>
                  </>
                )}
                <DM.Item className={item} onSelect={() => copyLink(id)}>
                  <Link2 size={14} aria-hidden /> Copy link to this view
                </DM.Item>
              </DM.Content>
            </DM.Portal>
          </DM.Root>
        </div>
      </div>
      <div className="min-w-0 flex-1">{asTable && table ? <DataTable t={table} /> : children}</div>
      {footer && <div className="mt-4 flex items-center justify-between gap-3 border-t border-divider pt-3">{footer}</div>}
    </section>
  );
}

export function DataTable({ t, className }: { t: TableData; className?: string }) {
  const numeric = t.columns.map((_, j) => t.rows.every((r) => /^[−\-+$]?[\d,.]+[%kMK]?$|^–$/.test(String(r[j]))));
  return (
    <div className={cn("max-h-96 overflow-auto", className)}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface-1">
          <tr className="border-b border-divider">
            {t.columns.map((c, j) => (
              <th key={c} className={cn("eyebrow h-9 px-2 font-medium", numeric[j] ? "text-right" : "text-left")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, i) => (
            <tr key={i} className="h-9 border-b border-divider last:border-0 hover:bg-surface-2">
              {r.map((v, j) => (
                <td key={j} className={cn("px-2", numeric[j] ? "mono text-right text-xs" : "text-fg-muted")}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
