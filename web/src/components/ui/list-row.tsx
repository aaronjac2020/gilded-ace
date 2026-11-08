import { m } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { hoverStore, useHover } from "../../lib/uiStore";
import type { Verdict } from "../../theme/tokens";
import { StatusPill } from "./status-pill";

export type RowItem = {
  id: string;
  verdict: Verdict;
  meta: ReactNode;
  metric: ReactNode;
  mini?: ReactNode;
  /** Small tag before the metric, e.g. list membership. */
  tag?: ReactNode;
  title?: string;
  highlight?: boolean;
};

/**
 * Linear-style dense list: status pill, mono ID, meta, right-aligned metric, 60px mini chart, chevron.
 * ↑/↓ or J/K move, Enter opens. Hovering a row highlights that machine everywhere.
 */
export function RowList({
  items,
  onOpen,
  selected,
  label,
  testId,
}: {
  items: RowItem[];
  onOpen: (id: string) => void;
  selected?: string | null;
  label: string;
  testId?: string;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const hover = useHover();
  const move = (e: KeyboardEvent<HTMLLIElement>, i: number) => {
    const k = e.key;
    let j = -1;
    if (k === "ArrowDown" || k === "j") j = Math.min(items.length - 1, i + 1);
    else if (k === "ArrowUp" || k === "k") j = Math.max(0, i - 1);
    else if (k === "Enter" || k === " ") {
      e.preventDefault();
      onOpen(items[i].id);
      return;
    }
    if (j >= 0) {
      e.preventDefault();
      (ref.current?.children[j] as HTMLElement | undefined)?.focus();
    }
  };
  return (
    <ol ref={ref} aria-label={label} data-testid={testId} className="-mx-2">
      {items.map((it, i) => {
        const sel = selected === it.id;
        const dim = hover != null && hover !== it.id && items.some((x) => x.id === hover);
        return (
          <li
            key={it.id}
            tabIndex={0}
            onKeyDown={(e) => move(e, i)}
            onClick={() => onOpen(it.id)}
            onMouseEnter={() => hoverStore.set(it.id)}
            onMouseLeave={() => hoverStore.set(null)}
            onFocus={() => hoverStore.set(it.id)}
            onBlur={() => hoverStore.set(null)}
            title={it.title}
            data-machine-row={it.id}
            className={cn(
              "focus-ring group relative flex h-row cursor-pointer items-center gap-3 rounded-sm px-2 text-sm transition-[background-color,opacity] duration-hover ease-out hover:bg-surface-2",
              sel && "bg-gold/10",
              dim && "opacity-25",
            )}
          >
            {(sel || it.highlight) && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-gold" aria-hidden />}
            <m.span layoutId={`pill-${it.id}`} className="w-[92px] shrink-0">
              <StatusPill verdict={it.verdict} />
            </m.span>
            <m.span layoutId={`id-${it.id}`} className="num w-[54px] shrink-0 font-mono text-xs text-fg">
              {it.id}
            </m.span>
            <span className="min-w-0 flex-1 truncate text-fg-muted">{it.meta}</span>
            {it.tag && <span className="shrink-0">{it.tag}</span>}
            <span className="mono shrink-0 text-right text-xs text-fg">{it.metric}</span>
            {it.mini && <span className="hidden w-[60px] shrink-0 sm:block">{it.mini}</span>}
            <ChevronRight size={14} strokeWidth={1.5} className="shrink-0 text-fg-subtle group-hover:text-fg-muted" aria-hidden />
          </li>
        );
      })}
    </ol>
  );
}

/** 60px dot-and-whisker: shrunk effect with 90% CI on a fixed 0.8–1.2 scale, 1.0 tick = "as expected". */
export function CiBar({ v, lo, hi, min = 0.8, max = 1.2 }: { v: number; lo: number; hi: number; min?: number; max?: number }) {
  const x = (t: number) => Math.max(1, Math.min(59, ((t - min) / (max - min)) * 60));
  const weak = hi < 1;
  return (
    <svg width="60" height="16" viewBox="0 0 60 16" aria-hidden className="overflow-visible">
      <line x1={x(1)} x2={x(1)} y1={2} y2={14} className="stroke-fg-subtle" strokeWidth={1} strokeDasharray="2 2" />
      <line x1={x(lo)} x2={x(hi)} y1={8} y2={8} className={weak ? "stroke-gold" : "stroke-fg-muted"} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={x(v)} cy={8} r={2.5} className={weak ? "fill-gold-soft" : "fill-fg"} />
    </svg>
  );
}
