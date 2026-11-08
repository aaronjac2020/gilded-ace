import { m, useReducedMotion } from "framer-motion";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Ivory card with a maroon lattice back. `deal` slides it in from the shoe (top right) after `delay`;
 * `faceUp` flips it on the Y axis. Transform/opacity only; reduced motion renders face-up in place.
 */
export function PlayingCard({
  faceUp = true,
  deal = false,
  delay = 0,
  flipDelay = 0,
  fan = 0,
  suit,
  className,
  children,
}: {
  faceUp?: boolean;
  deal?: boolean;
  delay?: number;
  flipDelay?: number;
  fan?: number;
  suit?: string;
  className?: string;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const up = reduce ? true : faceUp;
  const red = suit ? /[♥♦]/.test(suit) : false;
  return (
    <m.div
      className={cn("relative [perspective:900px]", className)}
      initial={deal && !reduce ? { opacity: 0, x: 120, y: -90, rotate: 14 } : false}
      animate={{ opacity: 1, x: 0, y: 0, rotate: fan }}
      transition={{ delay, duration: 0.38, ease: EASE }}
    >
      <m.div
        className="relative h-full w-full [transform-style:preserve-3d]"
        initial={false}
        animate={{ rotateY: up ? 0 : 180 }}
        transition={{ delay: flipDelay, duration: 0.42, ease: EASE }}
      >
        <div className="card-face backface-hidden absolute inset-0 overflow-hidden rounded-[10px]">
          {suit && (
            <>
              <span className={cn("serif absolute left-1.5 top-1 text-xs leading-none", red ? "text-suit-red" : "text-ink")} aria-hidden>
                {suit}
              </span>
              <span
                className={cn("serif absolute bottom-1 right-1.5 rotate-180 text-xs leading-none", red ? "text-suit-red" : "text-ink")}
                aria-hidden
              >
                {suit}
              </span>
            </>
          )}
          {children}
        </div>
        <div className="card-back backface-hidden absolute inset-0 rounded-[10px] [transform:rotateY(180deg)]" aria-hidden />
      </m.div>
    </m.div>
  );
}

/** Three-card shuffle, shown only when loading takes 300ms or more. */
export function CardShuffle({ label = "Shuffling" }: { label?: string }) {
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 300);
    return () => clearTimeout(t);
  }, []);
  return (
    <div aria-busy="true" aria-label="Loading" className="flex min-h-[60vh] flex-col items-center justify-center gap-6">
      {show && (
        <>
          <div className="relative h-[72px] w-[100px]" aria-hidden>
            {[0, 1, 2].map((i) => (
              <m.div
                key={i}
                className="card-back absolute left-[30px] top-0 h-[72px] w-[50px] rounded-[7px]"
                initial={{ x: 0, rotate: (i - 1) * 8 }}
                animate={
                  reduce
                    ? { x: (i - 1) * 18, rotate: (i - 1) * 8 }
                    : { x: [0, (i - 1) * 26, 0], rotate: [(i - 1) * 8, (i - 1) * -6, (i - 1) * 8] }
                }
                transition={{ duration: 1.1, repeat: reduce ? 0 : Infinity, delay: i * 0.12, ease: "easeInOut" }}
              />
            ))}
          </div>
          <p className="label-sc">{label}…</p>
        </>
      )}
    </div>
  );
}
