import { Bridge, Chapter } from "../components/shell/Chapter";
import { ChapterPart } from "../components/ui/hero-band";
import Comps from "./Comps";
import Players from "./Players";

/** Chapter 4 · Guests & loyalty: who drives play (lead), then what the comp program spends. */
export default function Guests() {
  return (
    <Chapter testId="chapter-guests">
      <ChapterPart lead>
        <Players />
      </ChapterPart>
      <Bridge>The plan spends nothing on comps or players. This chapter checks that call: who drives play, and what comps cost.</Bridge>
      <ChapterPart title="What comps cost" answers="Q5">
        <Comps />
      </ChapterPart>
    </Chapter>
  );
}
