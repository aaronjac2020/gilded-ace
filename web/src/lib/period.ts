import type { Meta } from "./data";
import { useJson } from "./useData";

/** Day-index window [a, b] (inclusive, from date0) for the URL period, using meta.json's period table. */
export function usePeriodDays(period: string, date0 = "2025-01-01"): [number, number] | null {
  const meta = useJson<Meta>("meta.json").data;
  const p = meta?.periods[period];
  if (!p) return null;
  const day = (iso: string) => Math.round((Date.parse(iso) - Date.parse(date0)) / 86400000);
  return [day(p[0]), day(p[1])];
}

/** Day index -> ISO date. */
export const isoOf = (date0: string, d: number) => new Date(Date.parse(date0) + d * 86400000).toISOString().slice(0, 10);

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LONG: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};
