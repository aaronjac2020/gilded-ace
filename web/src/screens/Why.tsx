import { useMemo } from "react";
import { Chapter, Section } from "../components/shell/Chapter";
import { PERIOD_MENU } from "../components/shell/nav";
import { PlayingCard } from "../components/theme/PlayingCard";
import { REASON_ICON, ReasonStamp, reasonOf, tagsOf, useReasons } from "../components/Reason";
import { EmptyState, ErrorState, ScreenSkeleton } from "../components/ui/skeleton";
import { cn } from "../lib/cn";
import type { ScoreRow } from "../lib/data";
import { fmt } from "../lib/format";
import { REASON, tally, type Flags, type Reason } from "../lib/reasons";
import { useMachineParam } from "../lib/uiStore";
import { managerList } from "../lib/useData";
import { useFilters } from "../lib/urlState";
import ModelLab from "./ModelLab";

/** The three big hands. Setting counts every machine with that flag; the others count main reasons. */
const HANDS: { k: Reason; id: string; title: string; line: string }[] = [
  { k: "setting", id: "game-setting", title: "Set to pay back more", line: "Their game math keeps less of each bet, by design." },
  { k: "location", id: "location", title: "Quiet spots", line: "Few guests walk past. Any machine there would earn less." },
  { k: "weak", id: "ours", title: "Truly weak", line: "Draws less play than similar machines in similar spots. Worth replacing." },
];
/** Smaller reasons, one line each, so every machine on the list is accounted for. */
const MINOR: { k: Reason; line: string }[] = [
  { k: "inspect", line: "Pays out differently from its design. Verify before deciding." },
  { k: "luck", line: "Guests won more than usual. That evens out." },
  { k: "downtime", line: "Broken often enough to explain the shortfall." },
  { k: "none", line: "Earned less, but within normal range." },
];

/** Chapter 2 · Why they're low. */
export default function Why() {
  const [f, setF] = useFilters();
  const { rows, error, flags } = useReasons(f);
  const mgr = useMemo(() => managerList(rows), [rows]);
  const [, open] = useMachineParam();

  if (error) return <ErrorState what="scorecard" error={error} />;
  if (!rows.length && (f.zone || f.bank))
    return <EmptyState text="No machines match these filters." onClear={() => setF({ zone: null, bank: null })} />;
  if (!rows.length || !flags) return <ScreenSkeleton />;

  const ids = mgr.map((r) => r.machine_id);
  const t = tally(ids, flags);
  const per = PERIOD_MENU.find(([k]) => k === f.period)?.[1] ?? f.period;
  const main = (k: Reason) => mgr.filter((r) => reasonOf(flags, r.machine_id) === k);
  const inHand = (k: Reason) => (k === "setting" ? mgr.filter((r) => flags.get(r.machine_id)?.setting) : main(k));
  const second = (k: Reason) => mgr.filter((r) => tagsOf(flags, r.machine_id).includes(k)).map((r) => r.machine_id);
  const settingWeak = mgr.filter((r) => flags.get(r.machine_id)?.setting && flags.get(r.machine_id)?.weak).length;
  const openRow = (id: string) => open(id, ids);
  const rest = mgr.filter((r) => MINOR.some((m) => m.k === reasonOf(flags, r.machine_id)));

  return (
    <Chapter
      testId="chapter-why"
      eyebrow={`Chapter 2 · Why they're low · ${per}`}
      title={`${t.notProblem} of ${t.n} earn less for reasons a replacement won't fix`}
      sentence="Only the truly weak are worth replacing. A machine can have more than one reason."
      visual={
        <div data-testid="hands">
          <div className="grid gap-5 md:grid-cols-[1.25fr_1fr_1.25fr]">
            {HANDS.map((h) => {
              const cards = inHand(h.k);
              const Icon = REASON_ICON[h.k];
              return (
                <a
                  key={h.k}
                  href={`#${h.id}`}
                  className={cn(
                    "focus-ring card flex flex-col gap-4 p-6 transition-transform duration-hover hover:-translate-y-0.5",
                    h.k === "weak" && "ring-2 ring-inset ring-ink/80",
                  )}
                  data-hand={h.k}
                  data-count={cards.length}
                >
                  <span className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: REASON[h.k].color }}>
                    <Icon size={18} aria-hidden />
                    {h.title}
                  </span>
                  <span className="display text-[44px] leading-none text-fg">
                    {cards.length} <span className="text-[22px] text-fg-muted">of {t.n}</span>
                  </span>
                  <span className="-mt-2 text-[13px] text-fg-muted">
                    {h.k === "setting" ? `have this setting · ${t.counts.setting} as main reason` : "as main reason"}
                  </span>
                  <Fan rows={cards} flags={flags} />
                  <span className="text-[15px] text-fg-muted">
                    {h.line}
                    {h.k === "setting" && settingWeak > 0 && ` ${settingWeak} of these are also truly weak.`}
                  </span>
                </a>
              );
            })}
          </div>
          <ul className="card mt-5 grid divide-y divide-divider md:grid-cols-4 md:divide-x md:divide-y-0" aria-label="Other reasons">
            {MINOR.map((m) => {
              const Icon = REASON_ICON[m.k];
              const n2 = second(m.k);
              return (
                <li key={m.k} className="flex flex-col gap-1 px-5 py-4" data-hand={m.k} data-count={t.counts[m.k]}>
                  <span className="flex items-center gap-2 text-[15px] font-semibold" style={{ color: REASON[m.k].color }}>
                    <Icon size={16} aria-hidden />
                    <span className="tabular-nums text-fg">{t.counts[m.k]}</span> {REASON[m.k].label}
                  </span>
                  <span className="text-[13px] text-fg-muted">
                    as main reason{n2.length > 0 && `; also a second reason for ${n2.join(", ")}`}
                  </span>
                  <span className="text-[13px] text-fg-muted">{m.line}</span>
                </li>
              );
            })}
          </ul>
        </div>
      }
    >
      {HANDS.map((h) => (
        <Section key={h.k} id={h.id} title={h.title} answers="Q1" sentence={h.line}>
          <MachineRows rows={inHand(h.k)} flags={flags} onOpen={openRow} />
        </Section>
      ))}
      {rest.length > 0 && (
        <Section id="payout" title="The rest of the list" answers="Q1" sentence="A payout to verify, and any with no clear problem.">
          <MachineRows rows={rest} flags={flags} onOpen={openRow} />
        </Section>
      )}
      <div id="luck" />
      <div id="downtime" />
      <Section
        id="stay-weak"
        title="Do weak machines stay weak?"
        answers="Q1"
        sentence="Ranked on Jan–Apr, checked on unseen May–Jun play."
      >
        <ModelLab part="why" />
      </Section>
    </Chapter>
  );
}

function Fan({ rows, flags }: { rows: ScoreRow[]; flags: Map<string, Flags> }) {
  if (!rows.length) return <p className="text-[15px] text-fg-muted">None in this period.</p>;
  return (
    <div className="flex h-[84px] items-end pl-2" aria-hidden>
      {rows.map((r, i) => (
        <PlayingCard key={r.machine_id} suit="♠" fan={(i - (rows.length - 1) / 2) * 5} className="-ml-3 aspect-[5/7] w-[60px] first:ml-0">
          <div className="flex h-full flex-col items-center justify-center gap-1 text-ink">
            <span className="font-mono text-[13px] font-semibold">{r.machine_id.slice(2)}</span>
            <span className="h-1.5 w-6 rounded-full" style={{ background: REASON[reasonOf(flags, r.machine_id)].color }} />
          </div>
        </PlayingCard>
      ))}
    </div>
  );
}

function MachineRows({ rows, flags, onOpen }: { rows: ScoreRow[]; flags: Map<string, Flags>; onOpen: (id: string) => void }) {
  if (!rows.length) return <p className="text-base text-fg-muted">None in this period.</p>;
  return (
    <ul className="card divide-y divide-divider">
      {rows.map((r) => (
        <li key={r.machine_id}>
          <button
            type="button"
            onClick={() => onOpen(r.machine_id)}
            className="focus-ring flex w-full flex-wrap items-center gap-4 px-5 py-3.5 text-left hover:bg-surface-2"
            data-machine-row={r.machine_id}
          >
            <span className="w-16 font-mono text-[13px] font-semibold">{r.machine_id}</span>
            <span className="w-24 text-[15px] tabular-nums">{fmt.usdK(r.house_win_usd)}</span>
            <ReasonStamp reason={reasonOf(flags, r.machine_id)} size="sm" />
            <span className="ml-auto text-[13px] text-fg-muted">{r.theme}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
