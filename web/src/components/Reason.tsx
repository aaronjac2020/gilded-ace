import { m, useReducedMotion } from "framer-motion";
import { CircleDashed, Dices, MapPin, ScanSearch, SlidersHorizontal, TrendingDown, Wrench, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { cn } from "../lib/cn";
import { flagsFor, primary, REASON, secondary, type Flags, type Reason, type Rules, type VerdictRules } from "../lib/reasons";
import { useJson, useScorecard } from "../lib/useData";
import type { Filters } from "../lib/urlState";

export const REASON_ICON: Record<Reason, LucideIcon> = {
  inspect: ScanSearch,
  weak: TrendingDown,
  setting: SlidersHorizontal,
  downtime: Wrench,
  location: MapPin,
  luck: Dices,
  none: CircleDashed,
};

/** Shorter stamp text for card faces, where "Set to pay back more" would wrap. */
export const CARD_LABEL: Partial<Record<Reason, string>> = { setting: "Pays back more" };

type Meta = { rules: Rules; verdict_rules: VerdictRules };

/** Scorecard + per-machine reason flags (cutoffs are floor-wide, so flags use the unfiltered period). */
export function useReasons(f: Filters) {
  const sc = useScorecard(f);
  const meta = useJson<Meta>("meta.json").data;
  const flags = useMemo(
    () => (sc.all && meta?.verdict_rules ? flagsFor(sc.all, meta.verdict_rules, meta.rules) : null),
    [sc.all, meta],
  );
  return { ...sc, flags, rules: meta?.rules ?? null };
}

export const reasonOf = (flags: Map<string, Flags> | null, id: string): Reason => {
  const f = flags?.get(id);
  return f ? primary(f) : "none";
};
export const tagsOf = (flags: Map<string, Flags> | null, id: string): Reason[] => {
  const f = flags?.get(id);
  return f ? secondary(f) : [];
};

/** Rubber stamp for card faces and the case file. Inspect is outlined (dashed) and never filled. */
export function ReasonStamp({
  reason,
  animate = false,
  size = "md",
  compact = false,
  className,
}: {
  reason: Reason;
  animate?: boolean;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const reduce = useReducedMotion();
  const r = REASON[reason];
  const Icon = REASON_ICON[reason];
  return (
    <m.span
      initial={animate && !reduce ? { scale: 1.25, opacity: 0, rotate: -8 } : false}
      animate={{ scale: 1, opacity: 1, rotate: -1.5 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "inline-flex max-w-full items-center justify-center gap-1 whitespace-nowrap rounded-[4px] border-[1.5px] text-center font-sans font-bold leading-[1.15]",
        reason === "inspect" && "border-dashed",
        size === "sm" && "px-1.5 py-1 text-[13px]",
        size === "md" && "px-2 py-1 text-[14px]",
        size === "lg" && "px-3 py-1.5 text-[17px]",
        className,
      )}
      style={{ color: r.color, borderColor: r.color }}
      data-reason={reason}
      title={r.sub ? `${r.label}: ${r.sub}` : r.label}
    >
      {size !== "sm" && <Icon size={size === "lg" ? 17 : 14} strokeWidth={2} aria-hidden className="shrink-0" />}
      <span>{(compact && CARD_LABEL[reason]) || r.label}</span>
    </m.span>
  );
}

/** Inline tag for a secondary reason: icon + short label, colored. */
export function ReasonTag({ reason }: { reason: Reason }) {
  const r = REASON[reason];
  const Icon = REASON_ICON[reason];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-divider bg-card px-2 py-0.5 text-[13px] text-fg-muted">
      <Icon size={13} aria-hidden style={{ color: r.color }} />
      {r.label}
    </span>
  );
}
