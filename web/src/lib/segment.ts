import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** Player segment drilldown, one dimension at a time: "all" | "tier:Gold" | "region:Local" | "age:65+". Lives in ?seg=. */
export type SegDim = "tier" | "region" | "age";

export const DIM_LABEL: Record<SegDim, string> = { tier: "Tier", region: "Home region", age: "Age band" };

export function useSegment(): [string, (seg: string | null) => void] {
  const [sp, setSp] = useSearchParams();
  const seg = sp.get("seg") ?? "all";
  const set = useCallback(
    (s: string | null) =>
      setSp(
        (prev) => {
          const n = new URLSearchParams(prev);
          if (!s || s === "all") n.delete("seg");
          else n.set("seg", s);
          return n;
        },
        { replace: true },
      ),
    [setSp],
  );
  return [seg, set];
}

export function parseSeg(seg: string): { dim: SegDim; value: string } | null {
  const i = seg.indexOf(":");
  return i > 0 ? { dim: seg.slice(0, i) as SegDim, value: seg.slice(i + 1) } : null;
}

export function segLabel(seg: string): string {
  const p = parseSeg(seg);
  if (!p) return "all carded players";
  if (p.dim === "tier") return `${p.value}-tier players`;
  if (p.dim === "region") return `${p.value} players`;
  return p.value === "Unknown" ? "players with no age on file" : `players aged ${p.value}`;
}
