import { ArrowRight, LayoutGrid, List, PlayCircle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Chapter, Section } from "../components/shell/Chapter";
import { PERIOD_MENU } from "../components/shell/nav";
import { PlayingCard } from "../components/theme/PlayingCard";
import { GoldNumber } from "../components/theme/GoldNumber";
import { REASON_ICON, ReasonStamp, reasonOf, tagsOf, useReasons } from "../components/Reason";
import { buttonVariants } from "../components/ui/button";
import { EmptyState, ErrorState, ScreenSkeleton } from "../components/ui/skeleton";
import { cn } from "../lib/cn";
import type { ScoreRow } from "../lib/data";
import { fmt } from "../lib/format";
import { REASON, REASON_ANCHOR, REASON_ORDER, supportSentence, tally } from "../lib/reasons";
import { tourStore, useMachineParam } from "../lib/uiStore";
import { managerList, oursList } from "../lib/useData";
import { useFilters } from "../lib/urlState";

const STAGGER = 0.06;

/** Chapter 1 · The question. The manager's ten lowest earners, dealt face-down and turned over with a reason each. */
export default function Question() {
  const [f, setF] = useFilters();
  const { rows, error, flags, rules } = useReasons(f);
  const mgr = useMemo(() => managerList(rows), [rows]);
  const ours = useMemo(() => oursList(rows), [rows]);
  const [, open] = useMachineParam();

  if (error) return <ErrorState what="scorecard" error={error} />;
  if (!rows.length && (f.zone || f.bank))
    return <EmptyState text="No machines match these filters." onClear={() => setF({ zone: null, bank: null })} />;
  if (!rows.length || !flags || !rules) return <ScreenSkeleton />;

  const ids = mgr.map((r) => r.machine_id);
  const t = tally(ids, flags);
  const overlap = new Set(ours.map((r) => r.machine_id).filter((id) => ids.includes(id)));
  const openRow = (id: string) => open(id, [...new Set([...ids, ...ours.map((r) => r.machine_id)])]);
  const per = PERIOD_MENU.find(([k]) => k === f.period)?.[1] ?? f.period;
  const scope = f.bank ? ` · bank ${f.bank}` : f.zone ? ` · zone ${f.zone}` : "";

  return (
    <Chapter
      testId="chapter-question"
      eyebrow={`Chapter 1 · The question · ${per}${scope}`}
      title={
        <>
          <span data-testid="headline-count" data-value={t.notProblem}>
            <GoldNumber className="font-semibold">{`${t.notProblem} of ${t.n}`}</GoldNumber>
          </span>{" "}
          machines on the cut list aren&rsquo;t the problem
        </>
      }
      sentence={
        <>
          The manager wants to cut the {t.n} lowest earners. Only {t.weak} {t.weak === 1 ? "is" : "are"} truly weak. {supportSentence(ids, flags)}
        </>
      }
      visual={
        <>
          <ReasonChips counts={t.counts} />
          <Deal rows={mgr} flags={flags} ours={overlap} low={rules.low_hold_design} onOpen={openRow} />
        </>
      }
    >
      <p className="mt-4 text-[13px] text-fg-muted">Each card shows its main reason. A &ldquo;+&rdquo; line means a second reason also applies.</p>

      {t.setting > 0 && (
        <p id="game-setting" className="mt-6 scroll-mt-28 text-base text-fg-muted" data-testid="game-setting">
          <span className="font-semibold" style={{ color: REASON.setting.color }}>
            {t.setting} of {t.n}
          </span>{" "}
          are set to pay back more ({fmt.pct(rules.low_hold_design, 0)} hold vs a {fmt.pct(rules.floor_median_hold, 0)} floor median). That is the
          game&rsquo;s design.{" "}
          <Link to="/evidence#claim-game-setting" className="focus-ring rounded-sm font-semibold text-maroon underline-offset-4 hover:underline" data-evidence>
            Evidence
          </Link>
        </p>
      )}

      <Section
        id="ours"
        title="Our list instead"
        answers="Q1"
        sentence="Machines that draw less play than their spot should, in our model."
        aside={
          <Link to={{ pathname: "/why", hash: "ours" }} className="focus-ring rounded-sm text-sm font-semibold text-maroon hover:underline">
            How we picked them
          </Link>
        }
      >
        <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5" data-testid="ours-list" aria-label="Our list">
          {ours.map((r) => (
            <li key={r.machine_id}>
              <button
                type="button"
                onClick={() => openRow(r.machine_id)}
                className="focus-ring card group flex h-full w-full flex-col gap-2 p-4 text-left transition-transform duration-hover hover:-translate-y-0.5"
                data-machine-row={r.machine_id}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[13px] font-semibold text-fg">{r.machine_id}</span>
                  {overlap.has(r.machine_id) && <span className="rounded-full bg-gold/15 px-2 text-[13px] text-gold-soft">also on theirs</span>}
                </span>
                <span className="text-[15px] leading-snug text-fg">
                  draws <span className="font-semibold">{fmt.pct(1 - r.machine_effect_shrunk, 0)} less play</span> than its spot should
                </span>
                <span className="mt-auto text-[13px] text-fg-subtle">{r.theme}</span>
              </button>
            </li>
          ))}
        </ol>
      </Section>

      <div className="mt-16 flex flex-wrap gap-3">
        <Link to={{ pathname: "/why" }} className={buttonVariants({ variant: "primary", size: "lg" })}>
          See why they&rsquo;re low <ArrowRight size={18} aria-hidden />
        </Link>
        <button type="button" className={buttonVariants({ variant: "secondary", size: "lg" })} onClick={() => tourStore.set(0)}>
          <PlayCircle size={18} aria-hidden /> Take the 60-second tour
        </button>
      </div>
    </Chapter>
  );
}

/** The key above the table: main reasons grouped so "not the problem" + "truly weak" visibly add up to the list. */
function ReasonChips({ counts }: { counts: Record<string, number> }) {
  const chip = (k: (typeof REASON_ORDER)[number]) => {
    const Icon = REASON_ICON[k];
    return (
      <li key={k}>
        <Link
          to={{ pathname: "/why", hash: REASON_ANCHOR[k] }}
          className="focus-ring inline-flex h-9 items-center gap-2 rounded-full border border-divider bg-surface-1 px-3.5 text-[15px] text-fg shadow-card transition-[border-color,transform] duration-hover hover:-translate-y-0.5 hover:border-ring-strong"
          data-reason-chip={k}
          data-count={counts[k]}
          title={REASON[k].sub}
        >
          <Icon size={15} aria-hidden style={{ color: REASON[k].color }} />
          <span className="font-semibold tabular-nums">{counts[k]}</span> {REASON[k].label}
        </Link>
      </li>
    );
  };
  const notIt = REASON_ORDER.filter((k) => k !== "weak" && counts[k] > 0);
  const notN = notIt.reduce((s, k) => s + counts[k], 0);
  return (
    <div className="mb-5 flex flex-wrap items-start gap-x-8 gap-y-4" data-testid="reason-chips">
      <div>
        <p className="mb-2 text-[13px] font-semibold text-fg-muted">Not the problem · {notN}</p>
        <ul className="flex flex-wrap gap-2" aria-label="Not the problem">
          {notIt.map(chip)}
        </ul>
      </div>
      {counts.weak > 0 && (
        <div className="border-l border-divider pl-8">
          <p className="mb-2 text-[13px] font-semibold text-fg-muted">The problem · {counts.weak}</p>
          <ul className="flex gap-2" aria-label="The problem">
            {chip("weak")}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Felt table: ten cards dealt face-down, then turned in order. Cards are buttons from the first frame. */
function Deal({
  rows,
  flags,
  ours,
  low,
  onOpen,
}: {
  rows: ScoreRow[];
  flags: Parameters<typeof reasonOf>[0];
  ours: Set<string>;
  low: number;
  onOpen: (id: string) => void;
}) {
  const [view, setView] = useState<"cards" | "list">("cards");
  const [deal, setDeal] = useState(0);
  const [up, setUp] = useState(false);
  useEffect(() => {
    setUp(false);
    const t = setTimeout(() => setUp(true), 30);
    return () => clearTimeout(t);
  }, [deal]);
  const n = rows.length;

  return (
    <div className="rail px-8 pb-7 pt-5 md:px-12" data-testid="reveal-table">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] font-semibold text-card/90">The manager&rsquo;s cut list · lowest {n} by house win <span className="font-normal text-card/70">(what each kept after paying out)</span></p>
        <div className="flex items-center gap-2">
          {view === "cards" && (
            <button
              type="button"
              onClick={() => setDeal((d) => d + 1)}
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-card/85 hover:bg-white/10 hover:text-card"
            >
              <RotateCcw size={15} aria-hidden /> Replay
            </button>
          )}
          <div role="group" aria-label="View" className="flex rounded-md bg-black/20 p-0.5">
            {(
              [
                ["cards", "Cards", LayoutGrid],
                ["list", "List", List],
              ] as const
            ).map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "focus-ring flex h-8 items-center gap-1.5 rounded-[5px] px-2.5 text-[13px] font-semibold transition-colors duration-hover",
                  view === v ? "bg-card text-fg" : "text-card/80 hover:text-card",
                )}
              >
                <Icon size={14} aria-hidden /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "list" ? (
        <ol className="divide-y divide-divider overflow-hidden rounded-[10px] bg-card" data-testid="manager-list" aria-label="Manager's bottom 10">
          {rows.map((r) => (
            <li key={r.machine_id}>
              <button
                type="button"
                onClick={() => onOpen(r.machine_id)}
                className="focus-ring flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-surface-2"
                data-machine-row={r.machine_id}
              >
                <span className="w-16 font-mono text-[13px] font-semibold">{r.machine_id}</span>
                <span className="w-20 text-[15px] tabular-nums">{fmt.usdK(r.house_win_usd)}</span>
                <ReasonStamp reason={reasonOf(flags, r.machine_id)} size="sm" />
                <span className="ml-auto text-[13px] text-fg-subtle">
                  {ours.has(r.machine_id) ? "on our list" : <span data-testid="not-ours">not on our list</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <ol
          key={deal}
          className="grid grid-cols-[repeat(5,132px)] justify-center gap-x-5 gap-y-4"
          aria-label="Manager's bottom 10, as cards"
          data-testid="manager-list"
        >
          {rows.map((r, i) => {
            const reason = reasonOf(flags, r.machine_id);
            const tags = tagsOf(flags, r.machine_id);
            const setting = r.hold_expected <= low;
            return (
              <li key={r.machine_id} className="w-[132px]">
                <button
                  type="button"
                  onClick={() => onOpen(r.machine_id)}
                  className="focus-ring group block w-full rounded-[10px] text-left"
                  aria-label={`${r.machine_id}, house win ${fmt.usdK(r.house_win_usd)}, ${REASON[reason].label}${tags.length ? `, also ${tags.map((x) => REASON[x].label).join(", ")}` : ""}${ours.has(r.machine_id) ? ", on our list" : ", not on our list"}`}
                  data-machine-row={r.machine_id}
                  data-reason={reason}
                >
                  <PlayingCard
                    deal={deal > 0}
                    delay={i * STAGGER}
                    faceUp={up}
                    flipDelay={deal > 0 ? n * STAGGER + 0.25 + i * STAGGER : 0.15 + i * STAGGER}
                    suit="♠"
                    className="aspect-[5/7] w-full transition-transform duration-hover ease-out group-hover:-translate-y-1"
                  >
                    <div className="flex h-full flex-col items-center px-1.5 pb-3 pt-3.5 text-center text-ink">
                      <span className="font-mono text-[13px] font-semibold tracking-tight">{r.machine_id}</span>
                      <span className="serif mt-2.5 text-[24px] font-semibold leading-none">{fmt.usdK(r.house_win_usd)}</span>
                      <span className="mt-1 text-[13px] text-ink-2">house win</span>
                      {setting && reason !== "setting" && (
                        <span className="mt-2 whitespace-nowrap text-[13px] font-semibold" style={{ color: REASON.setting.color }}>
                          + pays back more
                        </span>
                      )}
                      <ReasonStamp reason={reason} size="sm" compact animate={up} className="mt-auto" />
                    </div>
                  </PlayingCard>
                  {!ours.has(r.machine_id) && (
                    <span className="sr-only" data-testid="not-ours">
                      not on our list
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
