import { BookOpen, Cpu, Gift, LayoutGrid, Map, PiggyBank, TrendingUp, Users, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { DateRangePicker } from "./DateRangePicker";
import { FilterBar } from "./FilterBar";

export const NAV = [
  { to: "/", label: "Verdict", icon: LayoutGrid },
  { to: "/floor", label: "Floor Map", icon: Map },
  { to: "/demand", label: "Demand", icon: TrendingUp },
  { to: "/downtime", label: "Downtime", icon: Wrench },
  { to: "/players", label: "Players", icon: Users },
  { to: "/comps", label: "Comps", icon: Gift },
  { to: "/model", label: "Model Lab", icon: Cpu },
  { to: "/plan", label: "$100k Plan", icon: PiggyBank },
  { to: "/method", label: "Methodology", icon: BookOpen },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { search } = useLocation();
  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-gold focus:px-3 focus:py-1 focus:text-bg"
      >
        Skip to content
      </a>
      <nav aria-label="Screens" className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-rule bg-surface px-3 py-5">
        <div className="mb-6 px-2">
          <p className="font-display text-xl font-semibold text-gold-soft">Gilded Ace</p>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Luck · Location · Leak</p>
        </div>
        <ul className="flex flex-col gap-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={{ pathname: to, search }}
                end={to === "/"}
                className={({ isActive }) =>
                  `focus-ring flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                    isActive ? "bg-maroon text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
                  }`
                }
              >
                <Icon size={16} aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="mt-auto px-2 text-[10px] leading-snug text-muted">
          Synthetic data, fictional casino. Findings are not facts about any real property.
        </p>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-rule bg-bg/90 backdrop-blur">
          <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-6 py-3">
            <DateRangePicker />
            <div className="flex items-center gap-3">
              <FilterBar />
              <NavLink to={{ pathname: "/method", search }} className="btn-ghost">
                <BookOpen size={14} aria-hidden /> Methodology
              </NavLink>
            </div>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-content flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
