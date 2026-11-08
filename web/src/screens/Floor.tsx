import { Chapter } from "../components/shell/Chapter";
import { ChapterPart } from "../components/ui/hero-band";
import Demand from "./Demand";
import Downtime from "./Downtime";
import FloorMap from "./FloorMap";
import { ForecastSection } from "./ModelLab";

/** Chapter 3 · The floor: when guests play (lead), where, what's coming, and what breakdowns cost. */
export default function Floor() {
  return (
    <Chapter testId="chapter-floor">
      <ChapterPart lead>
        <Demand />
      </ChapterPart>
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
