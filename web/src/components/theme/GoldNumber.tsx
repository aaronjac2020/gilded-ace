import { cn } from "../../lib/cn";

/** Brushed-gold text with a single 900ms sheen on mount (opacity + transform only). One per screen. */
export function GoldNumber({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("gold-text gold-sheen relative inline-block", className)} data-text={children}>
      {children}
    </span>
  );
}
