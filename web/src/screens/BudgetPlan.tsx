import { EvidenceLink } from "../components/EvidenceLink";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { Num } from "../components/ui/num";
import { ErrorState, ScreenSkeleton } from "../components/ui/skeleton";
import { Tile } from "../components/ui/tile";
import { rows, type Columnar } from "../lib/data";
import { fmt } from "../lib/format";
import { useJson } from "../lib/useData";

type Budget = {
  rules: { total_usd: number; horizon_days: number; max_action_types: number };
  formula: string;
  catalog: Columnar;
  recommended: Columnar;
  total_usd: number;
  kept_usd: number;
  effect: { lo: number; mid: number; hi: number };
  errors: string[];
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
const DEFAULT_FOCUS: Record<string, string> = { "/": "ours", "/floor": "map", "/demand": "traffic", "/downtime": "lost" };

function Evidence({ href }: { href: string }) {
  const [to, qs = ""] = href.split("?");
  const { focus, ...filters } = Object.fromEntries(new URLSearchParams(qs));
  return <EvidenceLink to={to} focus={focus ?? DEFAULT_FOCUS[to]} filters={filters} />;
}

export default function BudgetPlan() {
  const { data, error } = useJson<Budget>("budget.json");
  if (error) return <ErrorState what="budget" error={error} />;
  if (!data) return <ScreenSkeleton />;
  const lines = rows<Line>(data.recommended);
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
      >
        <KpiStrip testId="plan-kpis">
          <Kpi focal label="Spend" value={<Num value={data.total_usd} kind="usdCompact" />} note={`${fmt.pct(data.total_usd / cap)} of the cap`} />
          <Kpi label="Kept" value={<Num value={data.kept_usd} kind="usdCompact" />} note="Unspent, returned" />
          <Kpi
            label="Expected theo, mid"
            value={<Num value={data.effect.mid} kind="usdCompact" />}
            note={`Range ${fmt.usdK(data.effect.lo)}–${fmt.usdK(data.effect.hi)} within ${data.rules.horizon_days} days`}
          />
          <Kpi label="Action types" value={<Num value={lines.length} />} note={`Limit ${data.rules.max_action_types}`} />
        </KpiStrip>
      </HeroBand>

      <section id="plan" aria-label="Budget bar" className="mt-8 scroll-mt-20">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" title={data.formula}>
          {lines.map((l, i) => (
            <div key={l.action_type_id} className={i === 0 ? "bg-gold" : i === 1 ? "bg-gold-soft" : "bg-gold/50"} style={{ flex: l.cost_usd }} />
          ))}
          <div className="bg-surface-3" style={{ flex: data.kept_usd }} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-2xs text-fg-muted">
          {lines.map((l) => (
            <span key={l.action_type_id}>
              {l.name} <span className="mono text-fg">{fmt.usdK(l.cost_usd)}</span>
            </span>
          ))}
          <span>
            Kept <span className="mono text-fg">{fmt.usdK(data.kept_usd)}</span>
          </span>
          <span className="ml-auto text-fg-subtle">{data.formula}</span>
        </div>
        {data.errors.length > 0 && <p className="mt-2 text-xs text-verdict-downtime">{data.errors.join("; ")}</p>}
      </section>

      <div className="mt-6 grid grid-cols-12 gap-6" data-testid="plan-lines">
        {lines.map((l) => (
          <Tile
            key={l.action_type_id}
            className="col-span-12 lg:col-span-4"
            label={l.action_type_id}
            title={l.name}
            sub={
              <>
                <span className="mono text-gold-soft">{fmt.usd(l.cost_usd)}</span> · qty {l.quantity} · {l.targets}
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
                <div className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-gold-soft" style={{ left: `${(l.effect_mid_usd / hiMax) * 100}%` }} />
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
      <p className="mt-6 max-w-prose text-xs text-fg-subtle">
        Replacements keep paying after the horizon. The interactive allocator and sensitivity view arrive with the M11 optimizer.
      </p>
    </div>
  );
}
