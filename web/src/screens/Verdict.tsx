import { useMemo } from "react";
import { EvidenceLink } from "../components/EvidenceLink";
import { PERIOD_LABELS, PERIOD_LONG } from "../components/shell/TopBar";
import { MONTHS } from "../components/shell/nav";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { CiBar, RowList, type RowItem } from "../components/ui/list-row";
import { Delta, Num } from "../components/ui/num";
import { EmptyState, ErrorState, ScreenSkeleton } from "../components/ui/skeleton";
import { GameSettingChip } from "../components/ui/game-setting-chip";
import { Tile } from "../components/ui/tile";
import { GoldNumber } from "../components/theme/GoldNumber";
import { RevealTable } from "../components/theme/RevealTable";
import { MonthHighlights } from "../components/theme/MonthHighlights";

import { fmt } from "../lib/format";
import { useMachineParam } from "../lib/uiStore";
import { managerList, oursList, sum, useJson, useScorecard } from "../lib/useData";
import { useFilters } from "../lib/urlState";
import { verdictLabels, verdictOrder } from "../theme/tokens";

type Budget = { total_usd: number; kept_usd: number; effect: { lo: number; mid: number; hi: number } };
type Meta = { rules?: { low_hold_design: number; floor_median_hold: number } };

export default function Verdict() {
  const [f, setF] = useFilters();
  const { rows, error } = useScorecard(f);
  const mi = MONTHS.indexOf(f.period);
  const prior = useScorecard({ ...f, period: mi > 0 ? MONTHS[mi - 1] : f.period }).rows;
  const hasPrior = mi > 0 && prior.length > 0;
  const budget = useJson<Budget>("budget.json").data;
  const rules = useJson<Meta>("meta.json").data?.rules;
  const mgr = useMemo(() => managerList(rows), [rows]);
  const ours = useMemo(() => oursList(rows), [rows]);
  const [machine, open] = useMachineParam();

  if (error) return <ErrorState what="scorecard" error={error} />;
  if (!rows.length && (f.zone || f.bank))
    return <EmptyState text="No machines match these filters." onClear={() => setF({ zone: null, bank: null })} />;
  if (!rows.length) return <ScreenSkeleton />;

  const notWeak = mgr.filter((r) => r.verdict !== "truly_weak");
  const luckN = mgr.filter((r) => r.verdict === "luck").length;
  const locN = mgr.filter((r) => r.verdict === "location").length;
  const overlap = new Set(ours.map((r) => r.machine_id).filter((id) => mgr.some((m) => m.machine_id === id)));
  const theo = sum(mgr, (r) => r.theo_usd);
  const lost = sum(rows, (r) => r.lost_theo_usd);
  const lostLo = sum(rows, (r) => r.lost_theo_lo_usd);
  const lostHi = sum(rows, (r) => r.lost_theo_hi_usd);
  const luckAll = rows.filter((r) => r.verdict === "luck").length;
  const scope = f.bank ? `bank ${f.bank}` : f.zone ? `zone ${f.zone}` : "the floor";
  const per = PERIOD_LONG[f.period] ?? f.period;
  const priorLabel = mi > 0 ? PERIOD_LABELS[MONTHS[mi - 1]] : "";
  const pMgr = hasPrior ? managerList(prior) : [];

  const isLow = (r: { hold_expected: number }) => !!rules && r.hold_expected <= rules.low_hold_design;
  const lowN = mgr.filter(isLow).length;
  const ids = [...mgr, ...ours].map((r) => r.machine_id);
  const openRow = (id: string) => open(id, [...new Set(ids)]);
  const mgrItems: RowItem[] = mgr.map((r) => ({
    id: r.machine_id,
    verdict: r.verdict,
    title: r.verdict_reason,
    meta: (
      <>
        {r.theme} <span className="mono text-2xs text-fg-subtle">{r.zone_id}</span>
      </>
    ),
    metric: fmt.usdK(r.house_win_usd),
    highlight: overlap.has(r.machine_id),
    tag: (
      <span className="flex items-center gap-1.5">
        {rules && isLow(r) && <GameSettingChip hold={r.hold_expected} median={rules.floor_median_hold} />}
        {overlap.has(r.machine_id) ? (
          <span className="rounded-sm bg-gold/15 px-1.5 py-0.5 text-2xs text-gold-soft">on our list</span>
        ) : (
          <span className="rounded-sm border border-divider px-1.5 py-0.5 text-2xs text-fg-subtle" data-testid="not-ours">
            not on our list
          </span>
        )}
      </span>
    ),
  }));
  const ourItems: RowItem[] = ours.map((r) => ({
    id: r.machine_id,
    verdict: r.verdict,
    title: `Effect ${fmt.num(r.machine_effect_shrunk)} (90% CI ${fmt.num(r.effect_shrunk_lo)}–${fmt.num(r.effect_shrunk_hi)}) · ${fmt.usdK(r.coin_in_per_avail_hr)}/hr vs. ${fmt.usdK(r.location_expected_per_hr)} expected`,
    meta: (
      <>
        {r.theme} <span className="mono text-2xs text-fg-subtle">{r.zone_id}</span>
      </>
    ),
    metric: fmt.num(r.machine_effect_shrunk),
    mini: <CiBar v={r.machine_effect_shrunk} lo={r.effect_shrunk_lo} hi={r.effect_shrunk_hi} />,
    highlight: overlap.has(r.machine_id),
  }));
  const counts = verdictOrder.map((v) => [v, mgr.filter((r) => r.verdict === v).length] as const).filter(([, n]) => n > 0);

  return (
    <div>
      <HeroBand
        className="-mx-6"
        eyebrow={`The verdict · ${per}${f.zone || f.bank ? ` · ${scope}` : ""}`}
        title={
          <>
            <GoldNumber className="font-semibold">{`${notWeak.length} of ${mgr.length}`}</GoldNumber> aren&rsquo;t the problem
          </>
        }
        sub={<>The manager&rsquo;s {mgr.length} lowest earners, tested for luck, location, downtime and hold before any cut.</>}
      >
        <RevealTable
          rows={mgr}
          ours={overlap}
          lowHold={isLow}
          onOpen={openRow}
          list={<RowList items={mgrItems} onOpen={openRow} selected={machine} label="Manager's bottom 10" testId="manager-list" />}
          caption={
            <div className="flex flex-col gap-1.5">
              <p className="label-sc flex flex-wrap gap-x-4">
                {counts.map(([v, n]) => (
                  <span key={v}>
                    <span className="text-ivory">{n}</span> {verdictLabels[v]}
                  </span>
                ))}
              </p>
              {lowN > 0 && rules && (
                <p>
                  <span className="font-medium text-gold-soft">Game setting: pays back more by design.</span> {lowN} of {mgr.length} are
                  configured at {fmt.pct(rules.low_hold_design, 0)} hold vs. the floor&rsquo;s {fmt.pct(rules.floor_median_hold, 0)} median,
                  so the same play earns less house win. Game math, not a fault.
                </p>
              )}
              <details className="group mt-1 max-w-prose text-sm text-fg-muted">
                <summary className="focus-ring w-fit cursor-pointer list-none rounded-sm text-xs text-gold-soft hover:text-gold">
                  <span className="group-open:hidden">Show the math</span>
                  <span className="hidden group-open:inline">Hide the math</span>
                </summary>
                <p className="mt-2">
                  A moved machine&rsquo;s play mostly tracked its new spot (1 of 4 moves is informative), so the plan tests moves before
                  replacing machines in quiet spots.{" "}
                  {overlap.size === 0
                    ? "None of the manager's list also makes ours: machines that draw less play than their spot and game predict."
                    : `Only ${overlap.size} also ${overlap.size === 1 ? "makes" : "make"} our list of machines that draw less play than their spot and game predict.`}
                </p>
              </details>
            </div>
          }
        />
        <div className="mt-12">
          <KpiStrip testId="verdict-kpis">
            <Kpi
              testId="kpi-theo"
              label="Theo on the manager's list"
              value={<Num value={theo} kind="usdCompact" />}
              delta={hasPrior ? <Delta now={theo} prior={sum(pMgr, (r) => r.theo_usd)} label={priorLabel} /> : undefined}
              note={`House win ${fmt.usdK(sum(mgr, (r) => r.house_win_usd))}, ${fmt.usdK(sum(mgr, (r) => r.luck_resid_usd))} vs. theo`}
              footer={<EvidenceLink to="/floor" focus="map" filters={f} />}
            />
            <Kpi
              testId="kpi-luck"
              label="Luck / location"
              value={
                <>
                  <Num value={luckN} />
                  <span className="text-fg-subtle">/</span>
                  <Num value={locN} />
                </>
              }
              note={`${luckAll} machines on ${scope} lost to luck (|z| ≥ 1.64)`}
              footer={<EvidenceLink to="/floor" focus="map" filters={f} />}
            />
            <Kpi
              testId="kpi-downtime"
              label="Theo lost to downtime"
              value={<Num value={lost} kind="usdCompact" />}
              delta={
                hasPrior ? <Delta now={lost} prior={sum(prior, (r) => r.lost_theo_usd)} label={priorLabel} goodUp={false} /> : undefined
              }
              note={`Range ${fmt.usdK(lostLo)}–${fmt.usdK(lostHi)} · ${fmt.pct(
                lost /
                  Math.max(
                    1,
                    sum(rows, (r) => r.theo_usd),
                  ),
              )} of theo`}
              footer={<EvidenceLink to="/downtime" focus="lost" filters={f} />}
            />
            <Kpi
              testId="kpi-plan"
              label="Plan spend / kept"
              value={
                budget ? (
                  <>
                    <Num value={budget.total_usd} kind="usdCompact" />
                    <span className="text-fg-subtle">/</span>
                    <Num value={budget.kept_usd} kind="usdCompact" />
                  </>
                ) : (
                  "–"
                )
              }
              note={budget ? `Expected theo ${fmt.usdK(budget.effect.lo)}–${fmt.usdK(budget.effect.hi)} in 30 days` : undefined}
              footer={<EvidenceLink to="/plan" focus="plan" />}
            />
          </KpiStrip>
        </div>
        <MonthHighlights period={f.period} />
      </HeroBand>

      <section id="ours" aria-label="Our call" className="mt-16 grid grid-cols-12 gap-8">
        <Tile
          className="col-span-12"
          label="Our call"
          title="The 10 that draw less play than their spot predicts"
          sub="Lowest shrunk effect, 30+ days, still on the floor."
          testId="ours-list-tile"
          table={{
            columns: ["Machine", "Zone", "Theme", "Effect", "CI low", "CI high"],
            rows: ours.map((r) => [
              r.machine_id,
              r.zone_id,
              r.theme,
              fmt.num(r.machine_effect_shrunk),
              fmt.num(r.effect_shrunk_lo),
              fmt.num(r.effect_shrunk_hi),
            ]),
          }}
          footer={
            <p className="flex items-center gap-2 text-2xs text-fg-subtle">
              <CiBar v={0.94} lo={0.9} hi={0.98} /> effect with 90% CI · dashed tick = as expected (1.00)
              <span className="ml-auto">
                <EvidenceLink to="/model" focus="persistence" label="Does it persist?" />
              </span>
            </p>
          }
        >
          <RowList items={ourItems} onOpen={openRow} selected={machine} label="Our truly weak 10" testId="ours-list" />
        </Tile>
      </section>
    </div>
  );
}
