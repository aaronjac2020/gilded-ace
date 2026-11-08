import { BookOpen, HelpCircle, Map, PiggyBank, Search, Users, type LucideIcon } from "lucide-react";

export type NavItem = {
  to: string;
  /** "1 · The question" — chapter number is n; Evidence has none. */
  n?: number;
  label: string;
  title: string;
  answers?: string;
  icon: LucideIcon;
  key: string;
  card: string;
  /** Chapters 1-4 carry the period dropdown. */
  period: boolean;
};

/** The story, in order. `key` is the second stroke of the G-then-key jump. */
export const NAV: NavItem[] = [
  { to: "/", n: 1, label: "The question", title: "The question", answers: "Q1", icon: HelpCircle, key: "q", card: "A♠", period: true },
  { to: "/why", n: 2, label: "Why they're low", title: "Why they're low", answers: "Q1", icon: Search, key: "w", card: "K♠", period: true },
  { to: "/floor", n: 3, label: "The floor", title: "The floor", answers: "Q2 · Q3", icon: Map, key: "f", card: "Q♥", period: true },
  { to: "/guests", n: 4, label: "Guests & loyalty", title: "Guests & loyalty", answers: "Q4 · Q5", icon: Users, key: "g", card: "J♦", period: true },
  { to: "/plan", n: 5, label: "The plan", title: "The plan", answers: "Q6", icon: PiggyBank, key: "p", card: "K♥", period: false },
  { to: "/evidence", label: "Evidence", title: "Evidence", icon: BookOpen, key: "e", card: "A♣", period: false },
];

export const navFor = (path: string) => NAV.find((n) => n.to === path) ?? null;
export const nextFor = (path: string) => {
  const i = NAV.findIndex((n) => n.to === path);
  return i >= 0 && i < NAV.length - 1 ? NAV[i + 1] : null;
};

/**
 * Old routes -> chapter homes. `focus` overrides send an anchor that moved to a different chapter than its siblings.
 * Query (period, zone, bank, machine, focus) and hash are preserved, so claim deep links keep working.
 */
export const REDIRECTS: Record<string, { to: string; focus?: Record<string, string> }> = {
  "/model": { to: "/why", focus: { model2: "/floor", importance: "/evidence" } },
  "/demand": { to: "/floor" },
  "/downtime": { to: "/floor" },
  "/players": { to: "/guests" },
  "/comps": { to: "/guests" },
  "/method": { to: "/evidence" },
};

export const MONTHS = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];

export const PERIOD_LABELS: Record<string, string> = {
  full: "Jan–Jun",
  train: "Jan–Apr",
  test: "May–Jun",
  "2025-01": "Jan",
  "2025-02": "Feb",
  "2025-03": "Mar",
  "2025-04": "Apr",
  "2025-05": "May",
  "2025-06": "Jun",
};
/** Long form for titles and eyebrows. */
export const PERIOD_LONG: Record<string, string> = { ...PERIOD_LABELS };
/** Dropdown copy: "Showing Jan–Jun 2025". */
export const PERIOD_MENU: [string, string][] = [
  ["full", "Jan–Jun 2025"],
  ["train", "Jan–Apr 2025"],
  ["test", "May–Jun 2025"],
  ["2025-01", "January 2025"],
  ["2025-02", "February 2025"],
  ["2025-03", "March 2025"],
  ["2025-04", "April 2025"],
  ["2025-05", "May 2025"],
  ["2025-06", "June 2025"],
];
