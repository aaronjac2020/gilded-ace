import { ArrowDown, Check, Dice5, MapPin, Search, Wrench } from "lucide-react";
import { verdictColors, verdictLabels, type Verdict } from "../theme/tokens";

export const verdictIcons: Record<Verdict, typeof Dice5> = {
  luck: Dice5,
  location: MapPin,
  downtime: Wrench,
  inspect_hold: Search,
  truly_weak: ArrowDown,
  ok: Check,
};

export function VerdictChip({ verdict, size = "sm" }: { verdict: Verdict; size?: "sm" | "md" }) {
  const Icon = verdictIcons[verdict];
  const c = verdictColors[verdict];
  const pad = size === "md" ? "px-2.5 py-1 text-sm" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border font-medium ${pad}`}
      style={{ borderColor: c, color: verdict === "ok" ? "#9A8F8C" : c, background: `${c}1A` }}
      data-verdict={verdict}
    >
      <Icon size={size === "md" ? 14 : 12} aria-hidden />
      {verdictLabels[verdict]}
    </span>
  );
}
