import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** Global filter state lives in the URL so every view is deep-linkable (EvidenceLink). */
export type Filters = { period: string; zone: string | null; bank: string | null };

export const DEFAULT_PERIOD = "full";

export function useFilters(): [Filters, (patch: Partial<Filters>) => void] {
  const [sp, setSp] = useSearchParams();
  const f: Filters = { period: sp.get("period") ?? DEFAULT_PERIOD, zone: sp.get("zone"), bank: sp.get("bank") };
  const set = useCallback(
    (patch: Partial<Filters>) => {
      setSp(
        (prev) => {
          const n = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v == null || v === "" || (k === "period" && v === DEFAULT_PERIOD)) n.delete(k);
            else n.set(k, String(v));
          }
          return n;
        },
        { replace: true },
      );
    },
    [setSp],
  );
  return [f, set];
}

/** Build a query string carrying filters (+ optional focus anchor). */
export function filterQuery(f: Partial<Filters> & { focus?: string; machine?: string }): string {
  const n = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v != null && v !== "" && !(k === "period" && v === DEFAULT_PERIOD)) n.set(k, String(v));
  const s = n.toString();
  return s ? `?${s}` : "";
}
