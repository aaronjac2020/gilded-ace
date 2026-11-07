import { cn } from "../../lib/cn";
import { verdictLabels, type Verdict } from "../../theme/tokens";

/** Tailwind needs literal class names, so each verdict's tint classes are spelled out. */
const tint: Record<Verdict, string> = {
  luck: "bg-verdict-luck/10 ring-verdict-luck/25 text-verdict-luck",
  location: "bg-verdict-location/10 ring-verdict-location/25 text-gold-soft",
  downtime: "bg-verdict-downtime/10 ring-verdict-downtime/25 text-verdict-downtime",
  inspect_hold: "bg-verdict-inspect_hold/10 ring-verdict-inspect_hold/25 text-verdict-inspect_hold",
  truly_weak: "bg-verdict-truly_weak/10 ring-verdict-truly_weak/25 text-verdict-truly_weak",
  ok: "bg-fg-subtle/10 ring-fg-subtle/25 text-fg-muted",
};

export const dot: Record<Verdict, string> = {
  luck: "bg-verdict-luck",
  location: "bg-verdict-location",
  downtime: "bg-verdict-downtime",
  inspect_hold: "bg-verdict-inspect_hold",
  truly_weak: "bg-verdict-truly_weak",
  ok: "bg-fg-subtle",
};

/** Linear-style status pill: 6px dot + label, 25% tinted ring, 10% tinted fill. */
export function StatusPill({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <span
      className={cn("inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium ring-1 ring-inset", tint[verdict], className)}
      data-verdict={verdict}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot[verdict])} aria-hidden />
      {verdictLabels[verdict]}
    </span>
  );
}
