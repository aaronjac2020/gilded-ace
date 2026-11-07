import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn, MOD, store } from "../../lib/cn";
import { commandStore } from "../../lib/uiStore";
import { Kbd } from "../ui/kbd";
import { Tip } from "../ui/tooltip";
import { Monogram } from "./Monogram";
import { CardIndex } from "../theme/Deco";
import { NAV } from "./nav";

export function Sidebar() {
  const { search, pathname } = useLocation();
  const [rail, setRail] = useState(() => store.get("ga.rail") === "1");
  const toggle = () => {
    setRail((r) => {
      store.set("ga.rail", r ? "0" : "1");
      return !r;
    });
  };
  const keep = new URLSearchParams(search);
  keep.delete("machine");
  keep.delete("focus");
  const qs = keep.toString() ? `?${keep}` : "";

  return (
    <nav
      aria-label="Screens"
      className={cn(
        "felt-faint sticky top-0 hidden h-screen shrink-0 flex-col border-r border-gold/10 transition-[width] duration-menu ease-out md:flex",
        rail ? "w-rail" : "w-sidebar",
      )}
    >
      <div className={cn("flex h-topbar items-center gap-2.5", rail ? "justify-center" : "px-4")}>
        <Monogram size={24} />
        {!rail && (
          <span className="truncate text-sm font-semibold tracking-tight text-fg">
            Gilded Ace <span className="font-normal text-fg-subtle">Floor review</span>
          </span>
        )}
      </div>
      <div className={cn("pb-2", rail ? "px-2" : "px-3")}>
        <button
          type="button"
          onClick={() => commandStore.set(true)}
          className={cn(
            "focus-ring flex h-8 w-full items-center gap-2 rounded-sm bg-surface-2 text-sm text-fg-subtle ring-1 ring-inset ring-ring transition-colors duration-hover hover:text-fg-muted hover:ring-ring-strong",
            rail ? "justify-center" : "px-2",
          )}
          aria-label="Search and commands"
        >
          <Search size={14} strokeWidth={1.5} aria-hidden />
          {!rail && (
            <>
              <span className="flex-1 text-left">Search…</span>
              <Kbd>{MOD}</Kbd>
              <Kbd>K</Kbd>
            </>
          )}
        </button>
      </div>
      {(["Questions", "Evidence"] as const).map((sec) => (
        <div key={sec} className={cn("mt-4", rail ? "px-2" : "px-3")}>
          {!rail && <p className="eyebrow mb-1 px-2">{sec}</p>}
          <ul className="flex flex-col gap-px">
            {NAV.filter((n) => n.section === sec).map(({ to, label, icon: Icon, key, card }) => (
              <li key={to}>
                <Tip label={label} keys={["G", key.toUpperCase()]} side="right">
                  <NavLink
                    to={{ pathname: to, search: qs }}
                    end={to === "/"}
                    aria-label={label}
                    aria-current={(to === "/" ? pathname === "/" : pathname.startsWith(to)) ? "page" : undefined}
                    className={cn(
                      "focus-ring relative flex h-8 items-center gap-2.5 rounded-sm text-sm transition-colors duration-hover",
                      rail ? "justify-center" : "px-2",
                      (to === "/" ? pathname === "/" : pathname.startsWith(to))
                        ? "bg-maroon/45 text-gold-soft ring-1 ring-inset ring-gold/20 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-[image:var(--brushed)]"
                        : "text-fg-muted hover:bg-white/[0.03] hover:text-fg",
                    )}
                  >
                    <Icon size={16} strokeWidth={1.5} aria-hidden />
                    {!rail && (
                      <>
                        <span className="flex-1">{label}</span>
                        <CardIndex card={card} className="text-2xs opacity-70" />
                      </>
                    )}
                  </NavLink>
                </Tip>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className={cn("mt-auto pb-3", rail ? "px-2" : "px-3")}>
        {!rail && (
          <p className="mb-2 px-2 text-2xs text-fg-subtle">Synthetic data, fictional casino. Not findings about any real property.</p>
        )}
        <Tip label={rail ? "Expand sidebar" : "Collapse sidebar"} side="right">
          <button
            type="button"
            onClick={toggle}
            aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "focus-ring flex h-8 w-full items-center gap-2 rounded-sm text-sm text-fg-subtle hover:bg-surface-2 hover:text-fg-muted",
              rail ? "justify-center" : "px-2",
            )}
          >
            {rail ? <PanelLeftOpen size={16} strokeWidth={1.5} aria-hidden /> : <PanelLeftClose size={16} strokeWidth={1.5} aria-hidden />}
            {!rail && "Collapse"}
          </button>
        </Tip>
      </div>
    </nav>
  );
}
