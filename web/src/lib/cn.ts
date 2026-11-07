import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["2xs", "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl"] }] } },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? "⌘" : "Ctrl";

/** localStorage that never throws (private windows, blocked storage). */
export const store = {
  get(k: string): string | null {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      window.localStorage.setItem(k, v);
    } catch {
      /* ignore */
    }
  },
};
