import { Bridge, Chapter } from "../components/shell/Chapter";
import { ChapterPart } from "../components/ui/hero-band";
import Comps from "./Comps";
import Players from "./Players";

/** Chapter 4 · Guests & loyalty: what the comp program spends (lead), then who drives play. */
export default function Guests() {
  return (
    <Chapter testId="chapter-guests">
      <ChapterPart lead>
        <Comps />
      </ChapterPart>
      <Bridge>The plan spends nothing on comps or players. This chapter checks that call: what comps cost, and who drives play.</Bridge>
      <ChapterPart title="Who drives play" answers="Q4">
        <Players />
      </ChapterPart>
    </Chapter>
  );
}
