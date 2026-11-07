import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Ivory dealer puck: marks the active month and counts tour steps. */
export function DealerButton({ children, className, label }: { children?: ReactNode; className?: string; label?: string }) {
  return (
    <span
      className={cn(
        "card-face inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-semibold leading-none ring-1 ring-gold/60",
        className,
      )}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {children ?? "D"}
    </span>
  );
}
