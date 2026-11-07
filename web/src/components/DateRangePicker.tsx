import { useEffect, useState } from "react";
import { load, type Meta } from "../lib/data";
import { useFilters } from "../lib/urlState";

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

/** Preset period chips. Each preset has a precomputed scorecard (bootstrap CIs can't run in-browser). */
export function DateRangePicker() {
  const [f, set] = useFilters();
  const [periods, setPeriods] = useState<string[]>([]);
  useEffect(() => {
    load<Meta>("meta.json").then((m) => setPeriods(Object.keys(m.periods)));
  }, []);
  return (
    <div role="radiogroup" aria-label="Period" className="flex flex-wrap items-center gap-1">
      {periods.map((p) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={f.period === p}
          data-period={p}
          onClick={() => set({ period: p })}
          className={`chip ${f.period === p ? "chip-on" : ""}`}
        >
          {PERIOD_LABELS[p] ?? p}
        </button>
      ))}
    </div>
  );
}
