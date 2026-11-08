import { Command } from "cmdk";
import { CalendarRange, Compass, Keyboard, Link2, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MOD, store } from "../../lib/cn";
import { loadRows, type ScoreRow } from "../../lib/data";
import { commandStore, shortcutsStore, tourStore, useCommandOpen } from "../../lib/uiStore";
import { useFilters } from "../../lib/urlState";
import { Keys } from "../ui/kbd";
import { StatusPill } from "../ui/status-pill";
import { copyLink } from "../ui/tile";
import { NAV, MONTHS } from "./nav";
import { PERIOD_LONG } from "./nav";

const RECENT = "ga.recent";
const item =
  "flex h-9 cursor-default select-none items-center gap-2.5 rounded-sm px-2 text-sm text-fg-muted data-[selected=true]:bg-surface-2 data-[selected=true]:text-fg";
const group = "[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3";

/** ⌘K: screens, machines, periods, actions. Machine IDs are mono; each item shows its shortcut. */
export function CommandMenu() {
  const open = useCommandOpen();
  const nav = useNavigate();
  const { search } = useLocation();
  const [, setF] = useFilters();
  const [machines, setMachines] = useState<ScoreRow[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    loadRows<ScoreRow>("scorecard_full.json").then(setMachines, () => {});
    try {
      setRecent(JSON.parse(store.get(RECENT) ?? "[]"));
    } catch {
      setRecent([]);
    }
  }, [open]);

  const done = (label?: string) => {
    if (label) store.set(RECENT, JSON.stringify([label, ...recent.filter((r) => r !== label)].slice(0, 4)));
    commandStore.set(false);
  };
  const go = (to: string, label: string) => {
    const keep = new URLSearchParams(search);
    keep.delete("machine");
    keep.delete("focus");
    nav({ pathname: to, search: keep.toString() });
    done(label);
  };
  const openMachine = (id: string) => {
    const keep = new URLSearchParams(search);
    keep.set("machine", id);
    nav({ pathname: "/floor", search: keep.toString() });
    done(id);
  };
  const recentItems = recent.filter((r) => NAV.some((n) => n.label === r) || machines.some((m) => m.machine_id === r));

  return (
    <Command.Dialog
      open={open}
      onOpenChange={commandStore.set}
      label="Command menu"
      overlayClassName="fixed inset-0 z-50 bg-bg/60"
      contentClassName="fixed left-1/2 top-[14vh] z-50 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-xl bg-surface-3 shadow-float data-[state=open]:animate-fade-up"
    >
      <div className="flex h-12 items-center gap-2 border-b border-divider px-4">
        <Search size={16} strokeWidth={1.5} className="text-fg-subtle" aria-hidden />
        <Command.Input placeholder="Jump to a screen, machine or period…" className="h-full flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-subtle" />
        <button type="button" onClick={() => done()} aria-label="Close" className="focus-ring rounded-sm p-1 text-fg-subtle hover:text-fg">
          <X size={14} aria-hidden />
        </button>
      </div>
      <Command.List className="max-h-[400px] overflow-y-auto p-2">
        <Command.Empty className="py-8 text-center text-sm text-fg-muted">No matches.</Command.Empty>
        {recentItems.length > 0 && (
          <Command.Group heading="Recent" className={group}>
            {recentItems.map((r) => {
              const n = NAV.find((x) => x.label === r);
              return (
                <Command.Item key={`r-${r}`} value={`recent ${r}`} className={item} onSelect={() => (n ? go(n.to, n.label) : openMachine(r))}>
                  {n ? <n.icon size={16} strokeWidth={1.5} aria-hidden /> : <Search size={16} strokeWidth={1.5} aria-hidden />}
                  <span className={n ? "" : "mono text-xs"}>{r}</span>
                </Command.Item>
              );
            })}
          </Command.Group>
        )}
        <Command.Group heading="Chapters" className={group}>
          {NAV.map((n) => (
            <Command.Item key={n.to} value={`screen ${n.label} ${n.answers ?? ""} ${n.n ?? ""}`} className={item} onSelect={() => go(n.to, n.label)}>
              <n.icon size={16} strokeWidth={1.5} aria-hidden />
              <span className="flex-1">{n.label}</span>
              <Keys keys={["G", n.key.toUpperCase()]} />
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Actions" className={group}>
          <Command.Item value="start judge tour" className={item} onSelect={() => (done(), tourStore.set(0))}>
            <Compass size={16} strokeWidth={1.5} aria-hidden />
            <span className="flex-1">Start judge tour</span>
          </Command.Item>
          <Command.Item value="copy link" className={item} onSelect={() => (done(), copyLink())}>
            <Link2 size={16} strokeWidth={1.5} aria-hidden />
            <span className="flex-1">Copy link to this view</span>
          </Command.Item>
          <Command.Item value="keyboard shortcuts" className={item} onSelect={() => (done(), shortcutsStore.set(true))}>
            <Keyboard size={16} strokeWidth={1.5} aria-hidden />
            <span className="flex-1">Keyboard shortcuts</span>
            <Keys keys={["?"]} />
          </Command.Item>
          <Command.Item value="clear filters" className={item} onSelect={() => (setF({ zone: null, bank: null }), done())}>
            <X size={16} strokeWidth={1.5} aria-hidden />
            <span className="flex-1">Clear filters</span>
          </Command.Item>
        </Command.Group>
        <Command.Group heading="Periods" className={group}>
          {["full", "train", "test", ...MONTHS].map((p) => (
            <Command.Item key={p} value={`period ${PERIOD_LONG[p]} ${p}`} className={item} onSelect={() => (setF({ period: p }), done())}>
              <CalendarRange size={16} strokeWidth={1.5} aria-hidden />
              <span className="flex-1">{PERIOD_LONG[p]}</span>
              {p.startsWith("2025") && <span className="text-2xs text-fg-subtle">[ / ]</span>}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Machines" className={group}>
          {machines.map((m) => (
            <Command.Item key={m.machine_id} value={`${m.machine_id} ${m.theme} ${m.zone_id} ${m.bank_id}`} className={item} onSelect={() => openMachine(m.machine_id)}>
              <span className="mono w-[54px] text-xs text-fg">{m.machine_id}</span>
              <span className="flex-1 truncate">
                {m.theme} <span className="mono text-2xs text-fg-subtle">{m.zone_id} › {m.bank_id}</span>
              </span>
              <StatusPill verdict={m.verdict} />
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
      <div className="flex h-9 items-center gap-3 border-t border-divider px-4 text-2xs text-fg-subtle">
        <Keys keys={["↑", "↓"]} /> navigate <Keys keys={["↵"]} /> open <Keys keys={["Esc"]} /> close
        <span className="ml-auto">
          <Keys keys={[MOD, "K"]} />
        </span>
      </div>
    </Command.Dialog>
  );
}
