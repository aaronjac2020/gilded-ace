import * as T from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { Keys } from "./kbd";

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <T.Provider delayDuration={300} skipDelayDuration={100}>
    {children}
  </T.Provider>
);

/** Small tooltip with an optional <kbd> shortcut hint. */
export function Tip({ label, keys, children, side = "bottom" }: { label: string; keys?: string[]; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="float z-50 flex items-center gap-2 px-2 py-1 text-xs text-fg data-[state=delayed-open]:animate-fade-up"
        >
          {label}
          {keys && <Keys keys={keys} />}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
