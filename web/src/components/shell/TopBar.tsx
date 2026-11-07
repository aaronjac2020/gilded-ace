import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Compass, Link2, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "../../lib/cn";
import { load, rows, type Columnar } from "../../lib/data";
import { tourStore, useMachineParam } from "../../lib/uiStore";
import { useFilters } from "../../lib/urlState";
import { Button } from "../ui/button";
import { copyLink } from "../ui/tile";
import { Tip } from "../ui/tooltip";
import { DealerButton } from "../theme/DealerButton";
import { MONTHS, navFor } from "./nav";
import { Playback, Readouts } from "./Playback";

export const PERIOD_LABELS: Record<string, string> = {
  full: "Jan–Jun",
  train: "Train",
  test: "Test",
  "2025-01": "Jan",
  "2025-02": "Feb",
  "2025-03": "Mar",
  "2025-04": "Apr",
  "2025-05": "May",
  "2025-06": "Jun",
};
/** Long form for titles and eyebrows. */
export const PERIOD_LONG: Record<string, string> = { ...PERIOD_LABELS, train: "Jan–Apr", test: "May–Jun" };

type Floor = { banks: Columnar; zones: Columnar };

export function TopBar() {
  const { pathname } = useLocation();
  const [f] = useFilters();
  const [machine] = useMachineParam();
  const screen = navFor(pathname);
  const crumbs = [f.zone, f.bank, machine].filter(Boolean) as string[];
  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center gap-4 border-b border-divider bg-bg/80 px-4 backdrop-blur-md md:px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="whitespace-nowrap text-fg">{screen?.title ?? "Not found"}</span>
        {crumbs.map((c) => (
          <span key={c} className="flex items-center gap-1.5 text-fg-muted">
            <span className="text-fg-subtle">›</span>
            <span className="mono whitespace-nowrap text-xs">{c}</span>
          </span>
        ))}
      </nav>
      <Readouts />
      <div className="ml-auto flex items-center gap-2">
        <Playback />
        <PeriodControl />
        <Filters />
        <Tip label="Copy link to this view">
          <Button variant="ghost" size="sm" aria-label="Copy link" onClick={() => copyLink()}>
            <Link2 size={14} strokeWidth={1.5} aria-hidden />
            <span className="hidden 2xl:inline">Copy link</span>
          </Button>
        </Tip>
        <Tip label="Start judge tour">
          <Button variant="secondary" size="sm" onClick={() => tourStore.set(0)} data-testid="tour-button">
            <Compass size={14} strokeWidth={1.5} aria-hidden />
            Tour
          </Button>
        </Tip>
      </div>
    </header>
  );
}

const seg = (on: boolean) =>
  cn(
    "focus-ring h-6 whitespace-nowrap rounded-[5px] px-2 text-xs font-medium transition-colors duration-hover",
    on ? "bg-surface-3 text-fg shadow-highlight ring-1 ring-inset ring-ring-strong" : "text-fg-muted hover:text-fg",
  );

/** Segmented period control. Months stay visible (one click each); [ and ] step months. */
export function PeriodControl() {
  const [f, set] = useFilters();
  return (
    <div role="radiogroup" aria-label="Period" data-testid="period-control" className="flex items-center gap-1">
      <div className="flex items-center gap-0.5 rounded-sm bg-surface-1 p-0.5 ring-1 ring-inset ring-ring">
        {["full", "train", "test"].map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={f.period === p}
            data-period={p}
            onClick={() => set({ period: p })}
            className={seg(f.period === p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>
      <div className="hidden items-center gap-0.5 rounded-sm bg-surface-1 p-0.5 ring-1 ring-inset ring-ring lg:flex">
        {MONTHS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={f.period === p}
            data-period={p}
            onClick={() => set({ period: p })}
            className={cn(seg(f.period === p), "relative")}
          >
            {PERIOD_LABELS[p]}
            {f.period === p && (
              <span aria-hidden className="pointer-events-none absolute -right-1.5 -top-1.5">
                <DealerButton className="h-3.5 min-w-3.5 px-0 text-[7px] ring-1" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function Filters() {
  const [f, set] = useFilters();
  const [floor, setFloor] = useState<Floor | null>(null);
  useEffect(() => {
    load<Floor>("floor.json").then(setFloor, () => {});
  }, []);
  const zones = useMemo(() => (floor ? rows<{ zone_id: string; name: string }>(floor.zones) : []), [floor]);
  const banks = useMemo(
    () => (floor ? rows<{ bank_id: string; zone_id: string }>(floor.banks).filter((b) => !f.zone || b.zone_id === f.zone) : []),
    [floor, f.zone],
  );
  const n = (f.zone ? 1 : 0) + (f.bank ? 1 : 0);
  return (
    <div className="flex items-center gap-1">
      {f.bank && <Chip label={f.bank} onClear={() => set({ bank: null })} />}
      {f.zone && !f.bank && <Chip label={f.zone} onClear={() => set({ zone: null, bank: null })} />}
      <Popover.Root>
        <Popover.Trigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Filters${n ? ` (${n} active)` : ""}`}>
            <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden />
            <span className="hidden 2xl:inline">Filters</span>
            {n > 0 && (
              <span className="mono rounded-full bg-gold/10 px-1.5 text-2xs text-gold-soft ring-1 ring-inset ring-gold/25">{n}</span>
            )}
            <ChevronDown size={12} aria-hidden />
          </Button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={6} className="float z-50 w-64 space-y-3 p-3 data-[state=open]:animate-fade-up">
            <label className="block">
              <span className="eyebrow">Zone</span>
              <select
                aria-label="Zone"
                className="select mt-1 w-full"
                value={f.zone ?? ""}
                onChange={(e) => set({ zone: e.target.value || null, bank: null })}
              >
                <option value="">All zones</option>
                {zones.map((z) => (
                  <option key={z.zone_id} value={z.zone_id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="eyebrow">Bank</span>
              <select
                aria-label="Bank"
                className="select mt-1 w-full"
                value={f.bank ?? ""}
                onChange={(e) => set({ bank: e.target.value || null })}
              >
                <option value="">All banks</option>
                {banks.map((b) => (
                  <option key={b.bank_id} value={b.bank_id}>
                    {b.bank_id}
                  </option>
                ))}
              </select>
            </label>
            {n > 0 && (
              <Button size="sm" className="w-full" onClick={() => set({ zone: null, bank: null })}>
                Clear filters
              </Button>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span
      className="mono inline-flex h-6 items-center gap-1 rounded-full bg-gold/10 pl-2 pr-1 text-2xs text-gold-soft ring-1 ring-inset ring-gold/25"
      data-filter-pill
    >
      {label}
      <button type="button" aria-label={`Clear ${label}`} onClick={onClear} className="focus-ring rounded-full p-0.5 hover:bg-gold/10">
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}
