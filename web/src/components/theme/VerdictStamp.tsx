import { m, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/cn";
import { verdictLabels, type Verdict } from "../../theme/tokens";

/** Ink on ivory (card faces) and tint on dark (drawer). Inspect always carries its caveat. */
const ink: Record<Verdict, string> = {
  luck: "text-[#245A8C]",
  location: "text-[#8A5310]",
  downtime: "text-[#8E2F3D]",
  inspect_hold: "text-[#5A3D9E]",
  truly_weak: "text-[#6E0F0F]",
  ok: "text-[#5C5350]",
};
const onDark: Record<Verdict, string> = {
  luck: "text-verdict-luck",
  location: "text-gold-soft",
  downtime: "text-verdict-downtime",
  inspect_hold: "text-verdict-inspect_hold",
  truly_weak: "text-verdict-truly_weak",
  ok: "text-fg-muted",
};

export function VerdictStamp({
  verdict,
  surface = "ivory",
  animate = false,
  size = "md",
  className,
}: {
  verdict: Verdict;
  surface?: "ivory" | "dark";
  animate?: boolean;
  /** sm: single-line label for narrow card faces. */
  size?: "sm" | "md";
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <m.span
      initial={animate && !reduce ? { scale: 1.2, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "inline-flex -rotate-3 flex-col items-center rounded-[3px] border-[1.5px] border-current px-1.5 py-0.5 font-mono uppercase leading-none",
        surface === "ivory" ? ink[verdict] : onDark[verdict],
        className,
      )}
      data-verdict={verdict}
    >
      <span className={cn("whitespace-nowrap font-bold", size === "sm" ? "text-[10px] tracking-[0.04em]" : "text-[10px] tracking-[0.1em]")}>
        {verdictLabels[verdict]}
      </span>
      {verdict === "inspect_hold" && (
        <span className="mt-0.5 whitespace-nowrap text-[8px] normal-case tracking-normal">lead, not a finding</span>
      )}
    </m.span>
  );
}
