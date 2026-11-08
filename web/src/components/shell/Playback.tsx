import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useRef } from "react";
import { commandStore, playingStore, usePlaying } from "../../lib/uiStore";
import { useFilters } from "../../lib/urlState";
import { sum, useScorecard } from "../../lib/useData";
import { Button } from "../ui/button";
import { Num } from "../ui/num";
import { Tip } from "../ui/tooltip";
import { MONTHS } from "./nav";

const STEP_MS = 1500;
const interactive = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(t.tagName) || t.role === "slider");

/** Month playback: steps the URL period every 1.5s. Off by default. Space plays/pauses, "," and "." step. */
export function Playback() {
  const [f, set] = useFilters();
  const playing = usePlaying();
  const setPlaying = (v: boolean) => playingStore.set(v);
  const i = MONTHS.indexOf(f.period);
  const setRef = useRef(set);
  setRef.current = set;
  const step = (d: 1 | -1) => {
    const j = i < 0 ? (d === 1 ? 0 : MONTHS.length - 1) : Math.min(MONTHS.length - 1, Math.max(0, i + d));
    set({ period: MONTHS[j] });
  };
  const toggle = () => {
    if (!playing && (i < 0 || i === MONTHS.length - 1)) set({ period: MONTHS[0] });
    setPlaying(!playing);
  };

  useEffect(() => {
    if (!playing) return;
    const id = setTimeout(() => {
      if (i < 0 || i >= MONTHS.length - 1) setPlaying(false);
      else setRef.current({ period: MONTHS[i + 1] });
    }, STEP_MS);
    return () => clearTimeout(id);
  }, [playing, i]);

  const keys = useRef({ toggle, step });
  keys.current = { toggle, step };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || commandStore.get() || interactive(e.target)) return;
      if (e.key === " ") {
        e.preventDefault();
        keys.current.toggle();
      } else if (e.key === ",") keys.current.step(-1);
      else if (e.key === ".") keys.current.step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex items-center" data-testid="playback">
      <Tip label="Previous month ( , )">
        <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => step(-1)} disabled={i === 0}>
          <ChevronLeft size={14} aria-hidden />
        </Button>
      </Tip>
      <Tip label={playing ? "Pause (Space)" : "Play months (Space)"}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={playing ? "Pause months" : "Play months"}
          aria-pressed={playing}
          onClick={toggle}
        >
          {playing ? <Pause size={14} aria-hidden /> : <Play size={14} aria-hidden />}
        </Button>
      </Tip>
      <Tip label="Next month ( . )">
        <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => step(1)} disabled={i === MONTHS.length - 1}>
          <ChevronRight size={14} aria-hidden />
        </Button>
      </Tip>
    </div>
  );
}

/** Floor readouts for the current period and scope. Hidden below 1280px. */
export function Readouts() {
  const [f] = useFilters();
  const { rows } = useScorecard(f);
  if (!rows.length) return null;
  const items: [string, number, "int" | "usdCompact"][] = [
    ["On floor", rows.length, "int"],
    ["Theo", sum(rows, (r) => r.theo_usd), "usdCompact"],
    ["Lost to downtime", sum(rows, (r) => r.lost_theo_usd), "usdCompact"],
  ];
  return (
    <dl
      className="hidden shrink-0 items-center gap-5 whitespace-nowrap border-l border-divider pl-5 min-[1360px]:flex"
      aria-label="Floor readouts"
      data-testid="readouts"
    >
      {items.map(([k, v, kind]) => (
        <div key={k} className="flex flex-col leading-tight">
          <dt className="label-sc text-[9.5px] text-fg-muted">{k}</dt>
          <dd className="mono text-sm text-fg">
            <Num value={v} kind={kind} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
