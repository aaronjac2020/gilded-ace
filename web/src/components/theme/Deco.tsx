import { cn } from "../../lib/cn";

/** Gold hairline with a stepped deco diamond at the centre. Original SVG. */
export function DecoRule({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/35" />
      <svg width="44" height="12" viewBox="0 0 44 12" className="text-gold/70">
        <path d="M0 6h14M30 6h14" stroke="currentColor" strokeWidth="1" />
        <path d="M22 1l5 5-5 5-5-5z" fill="none" stroke="currentColor" strokeWidth="1" />
        <path d="M22 3.5l2.5 2.5-2.5 2.5-2.5-2.5z" fill="currentColor" />
        <circle cx="15.5" cy="6" r="1" fill="currentColor" />
        <circle cx="28.5" cy="6" r="1" fill="currentColor" />
      </svg>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/35" />
    </div>
  );
}

const corner = {
  tl: "left-3 top-3",
  tr: "right-3 top-3 -scale-x-100",
  bl: "bottom-3 left-3 -scale-y-100",
  br: "bottom-3 right-3 -scale-100",
} as const;

/** Stepped deco corner in gold hairline, for framing felt tables. */
export function DecoCorner({ at, className }: { at: keyof typeof corner; className?: string }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      className={cn("pointer-events-none absolute text-gold/45", corner[at], className)}
      aria-hidden
    >
      <path d="M1 25V8l7-7h17" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M5 25V10l5-5h15" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.6" />
    </svg>
  );
}

/** Card index (rank + suit) used in every screen eyebrow. Red suits get card red. */
export function CardIndex({ card, className }: { card: string; className?: string }) {
  const red = /[♥♦]/.test(card);
  return (
    <span className={cn("serif font-semibold normal-case tracking-normal", red ? "text-[#E07A7D]" : "text-ivory", className)} aria-hidden>
      {card}
    </span>
  );
}
