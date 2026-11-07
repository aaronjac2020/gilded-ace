import { useEffect, useMemo, useState } from "react";
import { load, loadRows, type ScoreRow } from "./data";
import type { Filters } from "./urlState";

/** Generic async loader hook. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let live = true;
    fn().then(
      (data) => live && setState({ data, error: null }),
      (e) => live && setState({ data: null, error: String(e) }),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export function useJson<T>(name: string) {
  return useAsync<T>(() => load<T>(name), [name]);
}

/** Scorecard for the selected period, filtered by zone/bank. `all` is unfiltered (for floor-wide cut points). */
export function useScorecard(f: Filters) {
  const { data, error } = useAsync(() => loadRows<ScoreRow>(`scorecard_${f.period}.json`), [f.period]);
  const rows = useMemo(
    () => (data ?? []).filter((r) => (!f.zone || r.zone_id === f.zone) && (!f.bank || r.bank_id === f.bank)),
    [data, f.zone, f.bank],
  );
  return { all: data, rows, error };
}

/** The GM's rule: lowest total house win in the period. */
export function managerList(rows: ScoreRow[], n = 10): ScoreRow[] {
  return [...rows].sort((a, b) => a.house_win_usd - b.house_win_usd).slice(0, n);
}

/** Ours: truly_weak, >= 30 days and on floor at period end, lowest shrunk effect (mirrors verdicts.truly_weak_list). */
export function oursList(rows: ScoreRow[], n = 10, minDays = 30): ScoreRow[] {
  const elig = rows.filter((r) => r.days_on_floor >= minDays && r.on_floor_end);
  const tw = elig.filter((r) => r.verdict === "truly_weak").sort((a, b) => a.machine_effect_shrunk - b.machine_effect_shrunk);
  const pick = tw.slice(0, n);
  if (pick.length < n) {
    const ok = elig.filter((r) => r.verdict === "ok").sort((a, b) => a.machine_effect_shrunk - b.machine_effect_shrunk);
    pick.push(...ok.slice(0, n - pick.length));
  }
  return pick;
}

export function sum<T>(xs: T[], f: (x: T) => number): number {
  let s = 0;
  for (const x of xs) s += f(x) || 0;
  return s;
}
