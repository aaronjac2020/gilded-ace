import * as aq from "arquero";
import type { Columnar } from "./data";

/** machine_day_slim as an Arquero table (dictionary columns decoded). */
export function machineDayTable(c: Columnar & { date0: string }) {
  const cols: Record<string, unknown[]> = {};
  for (const k of c.columns) {
    const d = c.dicts?.[k];
    cols[k] = d ? c.data[k].map((i) => d[i as number]) : c.data[k];
  }
  return aq.table(cols);
}

export function dayIndex(date0: string, iso: string): number {
  return Math.round((Date.parse(iso) - Date.parse(date0)) / 86400000);
}

/** Floor totals for a date window and optional zone/bank filter. Ratio of sums. */
export function floorTotals(
  t: ReturnType<typeof machineDayTable>,
  date0: string,
  start: string,
  end: string,
  zone: string | null,
  bank: string | null,
) {
  const a = dayIndex(date0, start);
  const b = dayIndex(date0, end);
  let f = t.params({ a, b, zone, bank }).filter((d: any, $: any) => d.d >= $.a && d.d <= $.b);
  if (zone) f = f.filter((d: any, $: any) => d.zone === $.zone);
  if (bank) f = f.filter((d: any, $: any) => d.bank === $.bank);
  const r = f
    .rollup({
      coin_in: aq.op.sum("coin_in"),
      house_win: aq.op.sum("house_win"),
      theo: aq.op.sum("theo"),
      avail: aq.op.sum("available_hours"),
      sched: aq.op.sum("scheduled_hours"),
      machines: aq.op.distinct("machine_id"),
    })
    .object() as Record<string, number>;
  return { ...r, availability: r.sched ? r.avail / r.sched : 0, hold: r.coin_in ? r.house_win / r.coin_in : 0 };
}
