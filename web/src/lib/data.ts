/** Fetch + cache the pipeline's columnar JSON (see pipeline/export_web.py). */
export type Columnar = {
  columns: string[];
  data: Record<string, unknown[]>;
  dicts?: Record<string, unknown[]>;
};

const cache = new Map<string, Promise<unknown>>();

export function load<T = unknown>(name: string): Promise<T> {
  if (!cache.has(name)) {
    const p = fetch(`${import.meta.env.BASE_URL}data/${name}`).then((r) => {
      if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
      return r.json();
    });
    cache.set(name, p);
  }
  return cache.get(name) as Promise<T>;
}

/** Columnar -> array of row objects, decoding dictionary-encoded columns. */
export function rows<R = Record<string, unknown>>(c: Columnar): R[] {
  const n = c.columns.length ? c.data[c.columns[0]].length : 0;
  const cols = c.columns.map((k) => {
    const v = c.data[k];
    const d = c.dicts?.[k];
    return [k, d ? v.map((i) => d[i as number]) : v] as const;
  });
  const out: R[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r: Record<string, unknown> = {};
    for (const [k, v] of cols) r[k] = v[i];
    out[i] = r as R;
  }
  return out;
}

export async function loadRows<R = Record<string, unknown>>(name: string): Promise<R[]> {
  return rows<R>(await load<Columnar>(name));
}

export type Meta = {
  build_time: string;
  data_version: string;
  seed: number;
  periods: Record<string, [string, string]>;
  row_counts: Record<string, number>;
};

export type ScoreRow = {
  machine_id: string;
  days_on_floor: number;
  availability: number;
  coin_in_per_avail_hr: number;
  theo_usd: number;
  house_win_usd: number;
  luck_resid_usd: number;
  luck_z: number;
  hold_obs: number;
  hold_expected: number;
  hold_ci_lo: number;
  hold_ci_hi: number;
  location_expected_per_hr: number;
  machine_effect: number;
  machine_effect_shrunk: number;
  verdict: import("../theme/tokens").Verdict;
  verdict_reason: string;
  zone_id: string;
  bank_id: string;
  location_id: string;
  theme: string;
  config_id: string;
  lost_theo_usd: number;
  lost_theo_lo_usd: number;
  lost_theo_hi_usd: number;
  effect_shrunk_lo: number;
  effect_shrunk_hi: number;
  hold_flag: boolean;
  [k: string]: unknown;
};
