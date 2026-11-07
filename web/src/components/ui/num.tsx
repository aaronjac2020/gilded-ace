import NumberFlow, { type Format } from "@number-flow/react";
import { cn } from "../../lib/cn";

export type NumKind = "usd" | "usdCompact" | "int" | "pct" | "dec";

const FORMATS: Record<NumKind, Format> = {
  usd: { style: "currency", currency: "USD", maximumFractionDigits: 0 },
  usdCompact: { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 },
  int: { maximumFractionDigits: 0 },
  pct: { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 },
  dec: { minimumFractionDigits: 2, maximumFractionDigits: 2 },
};

export const formatNum = (v: number, kind: NumKind) => new Intl.NumberFormat("en-US", FORMATS[kind]).format(v);

/** Animated number (rolls on change). Plain text twin keeps it readable to screen readers and tests. */
export function Num({ value, kind = "int", className }: { value: number; kind?: NumKind; className?: string }) {
  return (
    <span className={cn("num relative inline-flex", className)}>
      <span className="sr-only">{formatNum(value, kind)}</span>
      <NumberFlow value={value} format={FORMATS[kind]} locales="en-US" aria-hidden willChange />
    </span>
  );
}

/** Tinted delta pill: "▲ 4.1% vs. Feb". `goodUp` decides the tint. */
export function Delta({ now, prior, label, goodUp = true }: { now: number; prior: number | null | undefined; label: string; goodUp?: boolean }) {
  if (prior == null || prior === 0) return null;
  const d = (now - prior) / Math.abs(prior);
  const up = d >= 0;
  const good = up === goodUp;
  return (
    <span
      className={cn(
        "num inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-2xs font-medium ring-1 ring-inset",
        good ? "bg-gold/10 text-gold-soft ring-gold/25" : "bg-fg-subtle/10 text-fg-muted ring-fg-subtle/25",
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(d * 100).toFixed(1)}% vs. {label}
    </span>
  );
}
