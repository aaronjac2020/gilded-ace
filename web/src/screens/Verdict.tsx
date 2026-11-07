import { motion, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AssertionTitle } from "../components/AssertionTitle";
import { PERIOD_LABELS } from "../components/DateRangePicker";
import { EvidenceLink } from "../components/EvidenceLink";
import { KpiCard } from "../components/KpiCard";
import { ErrorNote, Loading } from "../components/Loading";
import { VerdictChip } from "../components/VerdictChip";
import type { ScoreRow } from "../lib/data";
import { fmt } from "../lib/format";
import { managerList, oursList, sum, useJson, useScorecard } from "../lib/useData";
import { useFilters } from "../lib/urlState";
import { verdictColors } from "../theme/tokens";

type Budget = { total_usd: number; kept_usd: number; effect: { lo: number; mid: number; hi: number } };

export default function Verdict() {
  const [f] = useFilters();
  const { rows, error } = useScorecard(f);
  const budget = useJson<Budget>("budget.json").data;
  const mgr = useMemo(() => managerList(rows), [rows]);
  const ours = useMemo(() => oursList(rows), [rows]);

  if (error) return <ErrorNote what="scorecard" error={error} />;
  if (!rows.length) return <Loading />;

  const notWeak = mgr.filter((r) => r.verdict !== "truly_weak");
  const luckN = mgr.filter((r) => r.verdict === "luck").length;
  const locN = mgr.filter((r) => r.verdict === "location").length;
  const overlap = new Set(ours.map((r) => r.machine_id).filter((id) => mgr.some((m) => m.machine_id === id)));
  const lost = sum(rows, (r) => r.lost_theo_usd);
  const lostLo = sum(rows, (r) => r.lost_theo_lo_usd);
  const lostHi = sum(rows, (r) => r.lost_theo_hi_usd);
  const luckAll = rows.filter((r) => r.verdict === "luck").length;
  const scope = f.bank ? `bank ${f.bank}` : f.zone ? `zone ${f.zone}` : "the floor";
  const per = PERIOD_LABELS[f.period] ?? f.period;

  return (
    <div>
      <AssertionTitle
        kicker={`Verdict · ${per} · ${scope}`}
        sub={
          <>
            The manager would cut the {mgr.length} machines with the lowest house win. We test each one for luck, location, downtime
            and hold variance first. {notWeak.length} of {mgr.length} have another explanation; only {overlap.size} also make our
            list of machines that draw less play than their spot and game predict.
          </>
        }
      >
        {notWeak.length} of the manager&rsquo;s {mgr.length} aren&rsquo;t truly weak
      </AssertionTitle>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="verdict-kpis">
        <KpiCard
          hero
          testId="kpi-theo"
          label="Theo on the manager's list"
          value={fmt.usdK(sum(mgr, (r) => r.theo_usd))}
          note={`House win ${fmt.usdK(sum(mgr, (r) => r.house_win_usd))}: ${fmt.usdK(sum(mgr, (r) => r.luck_resid_usd))} vs. theo`}
          evidence={<EvidenceLink to="/floor" focus="map" filters={f} />}
        />
        <KpiCard
          testId="kpi-luck"
          label="Explained by luck / location"
          value={`${luckN} / ${locN}`}
          note={`${luckAll} machines on ${scope} lost to luck (|z| ≥ 1.64)`}
          evidence={<EvidenceLink to="/floor" focus="map" filters={f} />}
        />
        <KpiCard
          testId="kpi-downtime"
          label="Theo lost to downtime"
          value={fmt.usdK(lost)}
          note={`Range ${fmt.usdK(lostLo)}–${fmt.usdK(lostHi)} · ${fmt.pct(lost / Math.max(1, sum(rows, (r) => r.theo_usd)))} of theo`}
          evidence={<EvidenceLink to="/downtime" focus="lost" filters={f} />}
        />
        <KpiCard
          testId="kpi-plan"
          label="Recommended spend / kept"
          value={budget ? `${fmt.usdK(budget.total_usd)} / ${fmt.usdK(budget.kept_usd)}` : "–"}
          note={budget ? `Expected theo ${fmt.usdK(budget.effect.lo)}–${fmt.usdK(budget.effect.hi)} in 30 days` : undefined}
          evidence={<EvidenceLink to="/plan" focus="plan" />}
        />
      </div>

      <ListCompare mgr={mgr} ours={ours} overlap={overlap} />
    </div>
  );
}

const ROW_H = 76;

function ListCompare({ mgr, ours, overlap }: { mgr: ScoreRow[]; ours: ScoreRow[]; overlap: Set<string> }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const links = mgr.flatMap((m, i) => {
    const j = ours.findIndex((o) => o.machine_id === m.machine_id);
    return j >= 0 ? [{ id: m.machine_id, i, j }] : [];
  });

  return (
    <section id="ours" className="grid grid-cols-[1fr_72px_1fr] gap-0" aria-label="Manager's list compared with ours">
      <div>
        <h2 className="mb-1 text-sm font-semibold text-ink">Manager&rsquo;s bottom 10</h2>
        <p className="mb-3 text-xs text-muted">Lowest total house win. Chip = why the machine is low.</p>
        <ol data-testid="manager-list">
          {mgr.map((r, i) => (
            <motion.li
              key={r.machine_id}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03, ease: "easeOut" }}
              className="card mb-2 flex flex-col justify-center px-3"
              style={{ height: ROW_H - 8 }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium tabular-nums">
                  {r.machine_id} <span className="text-xs text-muted">{r.zone_id} · {r.theme}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm tabular-nums text-muted">{fmt.usd(r.house_win_usd)}</span>
                  <VerdictChip verdict={r.verdict} />
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted" title={r.verdict_reason}>
                {r.verdict_reason}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>

      <div ref={box} className="relative mt-[52px]" aria-hidden>
        <svg width={w} height={ROW_H * 10} className="overflow-visible">
          {links.map(({ id, i, j }) => (
            <motion.path
              key={id}
              d={`M0 ${i * ROW_H + ROW_H / 2 - 4} C ${w / 2} ${i * ROW_H + ROW_H / 2 - 4}, ${w / 2} ${j * ROW_H + ROW_H / 2 - 4}, ${w} ${j * ROW_H + ROW_H / 2 - 4}`}
              stroke={verdictColors.location}
              strokeWidth={2}
              fill="none"
              initial={reduce ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
            />
          ))}
        </svg>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-semibold text-ink">Our truly-weak 10</h2>
        <p className="mb-3 text-xs text-muted">Lowest shrunk machine effect (play vs. location expectation), ≥ 30 days, still on floor.</p>
        <ol data-testid="ours-list">
          {ours.map((r, i) => (
            <motion.li
              key={r.machine_id}
              initial={reduce ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25, delay: i * 0.03, ease: "easeOut" }}
              className={`card mb-2 flex flex-col justify-center px-3 ${overlap.has(r.machine_id) ? "border-gold/60" : ""}`}
              style={{ height: ROW_H - 8 }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium tabular-nums">
                  {r.machine_id} <span className="text-xs text-muted">{r.zone_id} · {r.theme}</span>
                </span>
                <span className="text-sm tabular-nums text-ink">effect {fmt.num(r.machine_effect_shrunk)}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                90% CI {fmt.num(r.effect_shrunk_lo)}–{fmt.num(r.effect_shrunk_hi)} · {fmt.usdK(r.coin_in_per_avail_hr)}/hr vs.{" "}
                {fmt.usdK(r.location_expected_per_hr)} expected
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
