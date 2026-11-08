import { useMemo } from "react";
import { Bridge, Chapter } from "../components/shell/Chapter";
import { managerList, useScorecard } from "../lib/useData";
import { useFilters } from "../lib/urlState";
import { ChapterPart } from "../components/ui/hero-band";
import Demand from "./Demand";
import Downtime from "./Downtime";
import FloorMap from "./FloorMap";
import { ForecastSection } from "./ModelLab";

/** Where the manager's ten sit, this period (ignores bank/zone filters so the count is always of the ten). */
function CutListZone() {
  const [f] = useFilters();
  const { all } = useScorecard({ ...f, zone: null, bank: null });
  const top = useMemo(() => {
    const by = new Map<string, { name: string; n: number }>();
    for (const r of managerList(all ?? [])) by.set(r.zone_id, { name: r.zone_name, n: (by.get(r.zone_id)?.n ?? 0) + 1 });
    return [...by.values()].sort((a, b) => b.n - a.n)[0];
  }, [all]);
  if (!top) return null;
  return (
    <Bridge>
      {top.n} of the 10 on the cut list sit in {top.name}, though most have a stronger reason first. This chapter shows where and when
      guests play.
    </Bridge>
  );
}

/** Chapter 3 · The floor: when guests play (lead), where, what's coming, and what breakdowns cost. */
export default function Floor() {
  return (
    <Chapter testId="chapter-floor">
      <ChapterPart lead>
        <Demand />
      </ChapterPart>
      <CutListZone />
      <ChapterPart title="Where the play is" answers="Q2">
        <FloorMap />
      </ChapterPart>
      <ChapterPart title="What the next weeks bring" answers="Q2">
        <section className="mt-24">
          <ForecastSection />
        </section>
      </ChapterPart>
      <ChapterPart title="What breakdowns cost" answers="Q3">
        <Downtime />
      </ChapterPart>
    </Chapter>
  );
}
