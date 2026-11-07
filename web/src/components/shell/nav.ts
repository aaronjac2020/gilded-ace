import { BookOpen, FlaskConical, Gift, LayoutList, Map, PiggyBank, TrendingUp, Users, Wrench, type LucideIcon } from "lucide-react";

export type NavItem = { to: string; label: string; title: string; q?: string; icon: LucideIcon; key: string; section: "Questions" | "Evidence"; card: string };

/** `key` is the second stroke of the G-then-key jump. `title` feeds <title> and breadcrumbs. */
export const NAV: NavItem[] = [
  { to: "/", label: "Verdict", title: "Verdict", q: "Q1", icon: LayoutList, key: "v", section: "Questions", card: "A♠" },
  { to: "/floor", label: "Floor Map", title: "Floor map", q: "Q2", icon: Map, key: "f", section: "Questions", card: "K♠" },
  { to: "/demand", label: "Demand", title: "Demand", q: "Q3", icon: TrendingUp, key: "d", section: "Questions", card: "Q♥" },
  { to: "/downtime", label: "Downtime", title: "Downtime", q: "Q4", icon: Wrench, key: "t", section: "Questions", card: "J♣" },
  { to: "/players", label: "Players", title: "Players", q: "Q5", icon: Users, key: "p", section: "Questions", card: "10♦" },
  { to: "/comps", label: "Comps", title: "Comps", q: "Q6", icon: Gift, key: "c", section: "Questions", card: "9♦" },
  { to: "/model", label: "Model Lab", title: "Model lab", icon: FlaskConical, key: "m", section: "Evidence", card: "Q♠" },
  { to: "/plan", label: "$100k Plan", title: "$100k plan", icon: PiggyBank, key: "b", section: "Evidence", card: "K♥" },
  { to: "/method", label: "Methodology", title: "Methodology", icon: BookOpen, key: "h", section: "Evidence", card: "A♣" },
];

export const navFor = (path: string) => NAV.find((n) => n.to === path) ?? null;

export const MONTHS = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];
