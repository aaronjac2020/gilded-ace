import { Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { EvidenceLink } from "../components/EvidenceLink";
import { SectionHeader } from "../components/shell/Chapter";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { Num } from "../components/ui/num";
import { ErrorState, ScreenSkeleton } from "../components/ui/skeleton";
import { Tile } from "../components/ui/tile";
import { BettingTable } from "../components/theme/BettingTable";
import { HOLD, lineCost, planTotal, validate, type AllocLine, type CatalogRow, type Rules } from "../lib/budget";
import { cn } from "../lib/cn";
import { rows, type Columnar } from "../lib/data";
import { fmt } from "../lib/format";
import { useJson } from "../lib/useData";

type Cmp = { cost_usd: number; theo_mid_usd: number; voi_usd: number; value_usd: number };
type MoveTest = {
  sizing: {
    swaps: number;
    moves: number;
    cost_usd: number;
    halfwidth: number;
    halfwidth_noise_only: number;
    halfwidth_tau_peer: number;
    theo_mid_usd: number;
  }[];
  power: { post_days: number };
  pick: { swaps: number; halfwidth: number; halfwidth_noise_only: number; halfwidth_tau_peer: number };
  voi_usd: number;
  voi_usd_tau_peer?: number;
  comparison: {
    move_test: Cmp & { value_usd_tau_peer?: number };
    lowest: Cmp & { action_type_id: string };
    replaces: string | null;
    errors: string[];
    included: boolean;
    included_tau_peer?: boolean;
  };
};
type Scenario = { scenario: string; label: string; plan: string; value_usd: number; cost_usd: number; changed: boolean };
type Budget = {
  rules: Rules;
  pool: Columnar;
  optimizer_pick: string[];
  sensitivity: Columnar | null;
  formula: string;
  catalog: Columnar;
  recommended: Columnar;
  total_usd: number;
  kept_usd: number;
  effect: { lo: number; mid: number; hi: number };
  errors: string[];
  move_test?: MoveTest | null;
};
type Line = {
  action_type_id: string;
  name: string;
  quantity: number;
  targets: string;
  cost_usd: number;
  effect_lo_usd: number;
  effect_mid_usd: number;
  effect_hi_usd: number;
  rationale: string;
  measurement: string;
  uncertainty: string;
  evidence: string;
};

/** Chart anchor to scroll to when an evidence href doesn't name one. */
/** Plain names for action codes in prose; tables keep the codes. */
const PLAIN: Record<string, string> = {
  "A-MOVE-MACHINE": "the move test",
  "A-MOVE-BANK": "a bank move",
  "A-REPLACE-LEASE": "lease replacement",
  "A-REPLACE-BUY": "buying a replacement",
  "A-TECH-SHIFT": "an extra technician",
  "A-PREVENTIVE": "preventive maintenance",
  "A-INSPECT": "inspection",
  "A-WAYFINDING": "the signage refresh",
  "A-COMP-PILOT": "a comp pilot",
  "A-COMP-CHANGE": "a comp rate change",
  "A-PROMO": "a promotion weekend",
  "A-SURVEY": "a guest survey",
  "A-HOLD": "keeping budget",
};
const plain = (s: string) => s.replace(/A-[A-Z-]+[A-Z]/g, (id) => PLAIN[id] ?? id);

const DEFAULT_FOCUS: Record<string, string> = { "/": "ours", "/floor": "map", "/demand": "traffic", "/downtime": "lost" };

function Evidence({ href }: { href: string }) {
  const [to, qs = ""] = href.split("?");
  const { focus, ...filters } = Object.fromEntries(new URLSearchParams(qs));
  return <EvidenceLink to={to} focus={focus ?? DEFAULT_FOCUS[to]} filters={filters} />;
}

/** Catalog names are per unit ("Relocate one machine"); show the planned quantity in the label. */
const lineName = (l: { name: string; quantity: number }) =>
  l.quantity > 1 ? l.name.replace(/one machine/, `${l.quantity} machines`) : l.name;

export default function BudgetPlan() {
  const { data, error } = useJson<Budget>("budget.json");
  if (error) return <ErrorState what="budget" error={error} />;
  if (!data) return <ScreenSkeleton />;
  const lines = rows<Line>(data.recommended);
  const assumed = lines.find((l) => l.action_type_id === "A-WAYFINDING")?.effect_mid_usd ?? 0;
  const cap = data.rules.total_usd;
  const hiMax = Math.max(...lines.map((l) => l.effect_hi_usd), 1);

  return (
    <div>
      <HeroBand
        className="-mx-6"
        eyebrow={`$100k plan · ${data.rules.horizon_days} days`}
        title={
          <>
            Spend {fmt.usdK(data.total_usd)} on {lines.length} targeted actions and keep {fmt.usdK(data.kept_usd)}
          </>
        }
        sub={`At most ${data.rules.max_action_types} action types under a ${fmt.usdK(cap)} cap. Keeping budget is a valid choice when the evidence is thin.`}
      />

      <section id="plan" aria-label="The bets" className="mt-16 scroll-mt-20">
        <BettingTable
          bets={lines.map((l) => ({
            id: l.action_type_id,
            name: lineName(l),
            cost: l.cost_usd,
            quantity: l.quantity,
            targets: l.targets,
            lo: l.effect_lo_usd,
            mid: l.effect_mid_usd,
            hi: l.effect_hi_usd,
          }))}
          held={data.kept_usd}
          formula={data.formula}
          total={data.effect}
        />
        {data.errors.length > 0 && <p className="mt-2 text-xs text-verdict-downtime">{data.errors.join("; ")}</p>}
      </section>
      <div className="mx-6 mt-14 md:mx-10">
        <KpiStrip testId="plan-kpis">
          <Kpi
            label="Spend"
            value={<Num value={data.total_usd} kind="usdCompact" />}
            note={`${fmt.pct(data.total_usd / cap)} of the cap`}
          />
          <Kpi label="Kept" value={<Num value={data.kept_usd} kind="usdCompact" />} note="Not spent in this plan" />
          <Kpi
            label="Expected theo, mid"
            value={<Num value={data.effect.mid} kind="usdCompact" />}
            note={`Range ${fmt.usdK(data.effect.lo)}–${fmt.usdK(data.effect.hi)} within ${data.rules.horizon_days} days; ${fmt.usdK(assumed)} rests on an assumed signage lift`}
          />
        </KpiStrip>
        <p className="mt-6 max-w-[760px] text-[15px] text-fg" data-testid="plan-payback">
          Spend and expected theo roughly match, so the plan about pays for itself. The bigger return is learning whether moves work before
          paying for replacements. Our 10 weakest get the same {data.rules.horizon_days}-day re-check; replace any still weak.
        </p>
      </div>

      <SectionHeader
        id="actions"
        title="The three actions"
        answers="Q6"
        sentence="What each costs, what it should return, and how we'll measure it."
        className="mt-20"
      />
      <div className="mt-8 grid grid-cols-12 gap-8" data-testid="plan-lines">
        {lines.map((l, i) => (
          <Tile
            key={l.action_type_id}
            className="col-span-12 lg:col-span-4"
            label={`Action ${i + 1}`}
            title={lineName(l)}
            sub={
              <>
                <span className="mono text-fg">{fmt.usdK(l.cost_usd)}</span> · qty {l.quantity} · {l.targets}
              </>
            }
            footer={<Evidence href={l.evidence} />}
          >
            <p className="text-sm text-fg">{l.rationale}</p>
            <div className="mt-4" aria-label={`Expected theo ${fmt.usdK(l.effect_lo_usd)} to ${fmt.usdK(l.effect_hi_usd)}`}>
              <p className="eyebrow">Expected theo, 30 days</p>
              <div className="relative mt-2 h-1.5 rounded-full bg-surface-2">
                <div
                  className="absolute inset-y-0 rounded-full bg-gold/40"
                  style={{ left: `${(l.effect_lo_usd / hiMax) * 100}%`, right: `${100 - (l.effect_hi_usd / hiMax) * 100}%` }}
                />
                <div
                  className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-gold-soft"
                  style={{ left: `${(l.effect_mid_usd / hiMax) * 100}%` }}
                />
              </div>
              <p className="mono mt-1.5 flex justify-between text-2xs text-fg-muted">
                <span>{fmt.usdK(l.effect_lo_usd)}</span>
                <span className="text-fg">mid {fmt.usdK(l.effect_mid_usd)}</span>
                <span>{fmt.usdK(l.effect_hi_usd)}</span>
              </p>
            </div>
            <p className="mt-3 text-xs text-fg-subtle">{l.uncertainty}</p>
            <p className="mt-3 text-xs text-fg-muted">
              <span className="font-medium text-fg">Measure:</span> {l.measurement}
            </p>
          </Tile>
        ))}
      </div>
      {data.move_test && <MoveTestCompare mt={data.move_test} />}
      <Allocator data={data} lines={lines} />
      {data.sensitivity && <Sensitivity data={data} />}
      <p className="mt-6 max-w-prose text-xs text-fg-subtle">
        Value of information is credited to the move test only; other lines count it as $0.
      </p>
    </div>
  );
}

/** Why the move test is (or isn't) in the plan: theo + value of information vs. the lowest-value line, plus the sizing behind N. */
function MoveTestCompare({ mt }: { mt: MoveTest }) {
  const c = mt.comparison;
  const rows: [string, Cmp][] = [
    ["A-MOVE-MACHINE (controlled test)", c.move_test],
    [`${c.lowest.action_type_id} (lowest-value line)`, c.lowest],
  ];
  return (
    <Tile
      className="mt-6"
      testId="move-test-compare"
      label="Plan choice"
      title={
        c.included
          ? `The move test replaces ${c.replaces ? plain(c.replaces) : "nothing"}: ${fmt.usdK(c.move_test.value_usd)} theo + information vs. ${fmt.usdK(c.lowest.value_usd)}`
          : `The move test stays out: ${fmt.usdK(c.move_test.value_usd)} vs. ${fmt.usdK(c.lowest.value_usd)} for ${plain(c.lowest.action_type_id)}`
      }
      sub="Information value = expected gain on the follow-on decision (lease-replace quiet-spot weak machines for 90 days) from knowing whether play follows the spot."
      table={{
        columns: ["Swaps (moves)", "Cost", "Planned 90% CI on slope", "Expected theo (mid)"],
        rows: mt.sizing.map((r) => [
          `${r.swaps} (${r.moves})${r.swaps === mt.pick.swaps ? " · plan" : ""}`,
          fmt.usd(r.cost_usd),
          `±${r.halfwidth.toFixed(2)}`,
          fmt.usd(r.theo_mid_usd),
        ]),
      }}
    >
      <table className="w-full text-sm">
        <thead className="text-left text-2xs text-fg-subtle">
          <tr>
            <th className="py-1 font-normal">Line</th>
            <th className="py-1 text-right font-normal">Cost</th>
            <th className="py-1 text-right font-normal">Theo (mid)</th>
            <th className="py-1 text-right font-normal">Info value</th>
            <th className="py-1 text-right font-normal">Total</th>
          </tr>
        </thead>
        <tbody className="mono">
          {rows.map(([k, r]) => (
            <tr key={k} className="border-t border-divider">
              <td className="py-1.5 font-sans text-fg">{k}</td>
              <td className="py-1.5 text-right">{fmt.usd(r.cost_usd)}</td>
              <td className="py-1.5 text-right">{fmt.usd(r.theo_mid_usd)}</td>
              <td className="py-1.5 text-right">{fmt.usd(r.voi_usd)}</td>
              <td className="py-1.5 text-right text-fg">{fmt.usd(r.value_usd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-fg-muted">
        Picked {mt.pick.swaps} swaps: the fewest with ≥ 3 swaps (so no single move carries the estimate) and a planned interval within ±0.2.
        Intervals are simulated from real same-bank play over {mt.power.post_days} operating days, plus machine-to-machine variation fitted
        to the 4 observed moves.
      </p>
      <p className="mt-2 text-xs text-fg-muted" data-testid="move-test-width">
        Planned interval at {mt.pick.swaps} swaps: <span className="mono text-fg">±{mt.pick.halfwidth.toFixed(2)}</span> with
        machine-to-machine variation (noise alone ±{mt.pick.halfwidth_noise_only.toFixed(2)}). The information value uses this realistic
        width.
        {mt.voi_usd_tau_peer != null && c.move_test.value_usd_tau_peer != null && (
          <>
            {" "}
            With the wider peer-calibrated variation (±{mt.pick.halfwidth_tau_peer.toFixed(2)}), information value is{" "}
            {fmt.usdK(mt.voi_usd_tau_peer)} and the test {c.included_tau_peer ? "still" : "would no longer"} beat
            {c.included_tau_peer ? "s" : ""} {plain(c.lowest.action_type_id)} ({fmt.usdK(c.move_test.value_usd_tau_peer)} vs.{" "}
            {fmt.usdK(c.lowest.value_usd)}).
          </>
        )}
      </p>
    </Tile>
  );
}

/**
 * Build-your-own plan from the catalog, starting at the recommendation. Every change is checked with the pipeline's rules
 * (lib/budget.ts mirrors pipeline/budget.py validate); a change that breaks one is refused and the reason shown.
 * Targets fill from the plan's ranked candidates, so a machine can't be both moved and replaced.
 */
function Allocator({ data, lines }: { data: Budget; lines: Line[] }) {
  const cat = useMemo(() => new Map(rows<CatalogRow>(data.catalog).map((c) => [c.action_type_id, c])), [data.catalog]);
  const pool = useMemo(() => rows<Line>(data.pool), [data.pool]);
  const cands = useMemo(() => {
    const m = new Map(pool.map((l) => [l.action_type_id, l.targets.split(", ").filter(Boolean)]));
    if (m.has("A-REPLACE-LEASE")) m.set("A-REPLACE-BUY", m.get("A-REPLACE-LEASE")!);
    return m;
  }, [pool]);
  const start = useMemo(() => Object.fromEntries(lines.map((l) => [l.action_type_id, l.quantity])), [lines]);
  const [qty, setQty] = useState<Record<string, number>>(start);
  const [blocked, setBlocked] = useState<{ id: string; errs: string[] } | null>(null);
  const ids = [...cat.keys()].filter((i) => i !== HOLD);
  const plan = (q: Record<string, number>): AllocLine[] =>
    ids.filter((i) => (q[i] ?? 0) > 0).map((i) => ({ id: i, quantity: q[i], targets: (cands.get(i) ?? []).slice(0, q[i]) }));
  const cur = plan(qty);
  const total = planTotal(cur, cat);
  const errs = validate(cur, cat, data.rules);
  const effect = (i: string, q: number) => {
    const p = pool.find((l) => l.action_type_id === i);
    return p ? (p.effect_mid_usd * Math.min(q, p.quantity)) / p.quantity : null;
  };
  const theo = cur.reduce((s, l) => s + (effect(l.id, l.quantity) ?? 0), 0);
  const tryStep = (i: string, d: number) => {
    const next = { ...qty, [i]: Math.max(0, (qty[i] ?? 0) + d) };
    const e = validate(plan(next), cat, data.rules);
    if (d > 0 && e.length) return setBlocked({ id: i, errs: e });
    setBlocked(null);
    setQty(next);
  };
  const wouldBlock = (i: string) => validate(plan({ ...qty, [i]: (qty[i] ?? 0) + 1 }), cat, data.rules).length > 0;
  const isRec = ids.every((i) => (qty[i] ?? 0) === (start[i] ?? 0));
  const cap = data.rules.total_usd;

  return (
    <Tile
      id="allocator"
      className="mt-6 scroll-mt-20"
      testId="allocator"
      label="Allocator"
      title={
        isRec
          ? `Starts at the recommendation: ${fmt.usdK(total)}, the same as the plan total`
          : `Your plan: ${fmt.usdK(total)} on ${cur.length} action type${cur.length === 1 ? "" : "s"}, ${fmt.usdK(cap - total)} kept`
      }
      sub={`Cost = quantity × (unit cost + daily cost × live days of ${data.rules.horizon_days}). Over budget, a 4th action type and incompatible combinations are refused.`}
      table={{
        columns: ["Action", "Cost per unit, 30 days", "Quantity", "Cost"],
        rows: ids.map((i) => [
          cat.get(i)!.name,
          fmt.usd(lineCost(cat.get(i)!, 1)),
          qty[i] ?? 0,
          fmt.usd(lineCost(cat.get(i)!, qty[i] ?? 0)),
        ]),
      }}
    >
      <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-[1fr_280px]">
        <table className="w-full text-sm">
          <thead className="text-left text-2xs text-fg-subtle">
            <tr>
              <th className="py-1 font-normal">Action</th>
              <th className="py-1 text-right font-normal">Per unit</th>
              <th className="py-1 text-center font-normal">Qty</th>
              <th className="py-1 text-right font-normal">Cost</th>
              <th className="py-1 text-right font-normal">Theo, mid</th>
            </tr>
          </thead>
          <tbody>
            {ids.map((i) => {
              const c = cat.get(i)!;
              const q = qty[i] ?? 0;
              const e = q > 0 ? effect(i, q) : null;
              const wb = wouldBlock(i);
              return (
                <tr key={i} data-action={i} className={cn("border-t border-divider", q > 0 ? "text-fg" : "text-fg-muted")}>
                  <td className="py-1.5 pr-3">
                    {c.name}
                    {blocked?.id === i && (
                      <span className="mt-0.5 block text-2xs text-verdict-downtime" data-testid="alloc-blocked" role="status">
                        Refused: {blocked.errs.join("; ")}
                      </span>
                    )}
                  </td>
                  <td className="mono py-1.5 text-right">{fmt.usd(lineCost(c, 1))}</td>
                  <td className="py-1.5">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Remove one ${c.unit}: ${c.name}`}
                        data-step="-1"
                        className="rounded p-0.5 hover:bg-surface-2 disabled:opacity-30"
                        disabled={q === 0}
                        onClick={() => tryStep(i, -1)}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="mono w-6 text-center">{q}</span>
                      <button
                        type="button"
                        aria-label={`Add one ${c.unit}: ${c.name}`}
                        data-step="1"
                        data-blocked={wb || undefined}
                        title={wb ? "This would break a plan rule" : undefined}
                        className={cn("rounded p-0.5 hover:bg-surface-2", wb && "opacity-30")}
                        onClick={() => tryStep(i, 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="mono py-1.5 text-right">{q > 0 ? fmt.usd(lineCost(c, q)) : "–"}</td>
                  <td className="mono py-1.5 text-right text-fg-muted">{q > 0 ? (e == null ? "not estimated" : fmt.usdK(e)) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="self-start">
          <p className="eyebrow">Spend vs. cap</p>
          <p className="mono mt-1 text-2xl text-fg" data-testid="alloc-total">
            {fmt.usd(total)}
          </p>
          <div className="relative mt-2 h-1.5 rounded-full bg-surface-2">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gold/60"
              style={{ width: `${Math.min(100, (total / cap) * 100)}%` }}
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-y-2 text-xs">
            <dt className="text-fg-subtle">Action types</dt>
            <dd className="mono text-right">
              {cur.length} / {data.rules.max_action_types}
            </dd>
            <dt className="text-fg-subtle">Kept</dt>
            <dd className="mono text-right">{fmt.usd(cap - total)}</dd>
            <dt className="text-fg-subtle">Theo, mid</dt>
            <dd className="mono text-right">{fmt.usdK(theo)}</dd>
            <dt className="text-fg-subtle">Recommended total</dt>
            <dd className="mono text-right" data-testid="plan-total">
              {fmt.usd(data.total_usd)}
            </dd>
          </dl>
          <p className={cn("mt-4 text-xs", errs.length ? "text-verdict-downtime" : "text-fg-muted")} data-testid="alloc-status">
            {errs.length ? errs.join("; ") : isRec ? "Valid · same as the recommended plan" : "Valid plan"}
          </p>
          {!isRec && (
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-gold-soft hover:text-maroon"
              onClick={() => {
                setQty(start);
                setBlocked(null);
              }}
            >
              <RotateCcw size={12} /> Reset to the recommendation
            </button>
          )}
          <p className="mt-4 text-2xs text-fg-subtle">
            Theo scales with quantity up to the plan's ranked candidates. Actions with no data-based estimate show none and add $0.
          </p>
        </div>
      </div>
    </Tile>
  );
}

/** "Machine inspection…: low end" → "machine inspection… at its low end"; one closing clause when every flip picks the same plan. */
function flipText(flips: Scenario[]): string {
  const what = (f: Scenario) => {
    const t = f.label.replace(/: (low|high) end$/, " at its $1 end");
    return t.charAt(0).toLowerCase() + t.slice(1);
  };
  const plan = (f: Scenario) => plain(f.plan).replace(" + ", " and ");
  const same = new Set(flips.map((f) => f.plan)).size === 1;
  return same
    ? `The pick changes in only ${flips.length}: ${flips.map(what).join(", or ")}. Then the plan drops to ${plan(flips[0])}.`
    : `The pick changes in only ${flips.length}: ${flips.map((f) => `${what(f)} picks ${plan(f)}`).join("; ")}.`;
}

/** Does the plan choice survive when one input moves? Exhaustive re-pick per scenario (pipeline/budget.py sensitivity). */
function Sensitivity({ data }: { data: Budget }) {
  const sc = rows<Scenario>(data.sensitivity!);
  const base = sc[0];
  const held = sc.filter((s) => !s.changed).length;
  const flips = sc.filter((s) => s.changed);
  const pool = rows<Line>(data.pool);
  const lo = Math.min(...sc.map((s) => s.value_usd));
  const hi = Math.max(...sc.map((s) => s.value_usd));
  const x = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;
  const bars = pool
    .map((l) => {
      const r = sc.filter((s) => s.scenario.startsWith(`${l.action_type_id}:`)).map((s) => s.value_usd);
      return { id: l.action_type_id, name: l.name, min: Math.min(...r), max: Math.max(...r) };
    })
    .sort((a, b) => b.max - b.min - (a.max - a.min));
  return (
    <Tile
      id="sensitivity"
      className="mt-6 scroll-mt-20"
      testId="sensitivity"
      label="Sensitivity"
      title={`The same plan wins in ${held} of ${sc.length} scenarios`}
      sub="Each scenario moves one input (a line's effect to its low or high end, or ±50% of mid; the move test's information value) and re-picks the best valid plan from the four candidate lines."
      table={{
        columns: ["Scenario", "Best plan", "Value (theo + information)", "Cost", "Changed"],
        rows: sc.map((s) => [s.label, s.plan, fmt.usd(s.value_usd), fmt.usd(s.cost_usd), s.changed ? "yes" : "no"]),
      }}
    >
      <p className="eyebrow">
        Best plan's value when one line's effect moves · base {fmt.usdK(base.value_usd)} = {fmt.usdK(data.effect.mid)} theo +{" "}
        {fmt.usdK(base.value_usd - data.effect.mid)} information
      </p>
      <div className="mt-3 space-y-3">
        {bars.map((b) => (
          <div key={b.id} className="grid grid-cols-[minmax(0,320px)_1fr_110px] items-center gap-4 text-xs">
            <span className="truncate text-fg-muted" title={b.name}>
              {b.name}
            </span>
            <div className="relative h-2 rounded-full bg-surface-2">
              <div className="absolute inset-y-0 rounded-full bg-gold/40" style={{ left: `${x(b.min)}%`, right: `${100 - x(b.max)}%` }} />
              <div className="absolute -top-0.5 h-3 w-0.5 bg-ivory" style={{ left: `${x(base.value_usd)}%` }} />
            </div>
            <span className="mono text-right text-fg-muted">
              {b.max - b.min < 1 ? "no change" : `${fmt.usdK(b.min)}–${fmt.usdK(b.max)}`}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm text-fg" data-testid="sensitivity-flips">
        {flips.length === 0 ? "No single change flips the plan." : flipText(flips)} Lease replacement never enters: it targets machines the
        move test already moves, and at its high end it is still worth less than the test once information value counts.
      </p>
      <p className="mt-2 text-xs text-fg-subtle">
        Inspection's low end is $0 (it may find nothing); at that end it no longer covers its {fmt.usd(1200)} and drops out. That is the
        price of checking, not a reason to skip it.
      </p>
    </Tile>
  );
}
