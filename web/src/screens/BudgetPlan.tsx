import { AssertionTitle } from "../components/AssertionTitle";
import { EvidenceLink } from "../components/EvidenceLink";
import { ErrorNote, Loading } from "../components/Loading";
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
  if (error) return <ErrorNote what="budget" error={error} />;
  if (!data) return <Loading />;
  const lines = rows<Line>(data.recommended);
  const pct = data.total_usd / data.rules.total_usd;

  return (
    <div>
      <AssertionTitle
        kicker="$100k plan · 30 days"
        sub={`At most ${data.rules.max_action_types} action types, ${fmt.usd(data.rules.total_usd)} cap, ${data.rules.horizon_days}-day horizon. Keeping budget is a valid choice.`}
      >
        Spend {fmt.usdK(data.total_usd)} on {lines.length} targeted actions and keep {fmt.usdK(data.kept_usd)}
      </AssertionTitle>

      <section id="plan" className="card mb-4 p-4" aria-label="Budget bar">
        <div className="mb-2 flex justify-between text-xs text-muted">
          <span>
            Spent <span className="tabular-nums text-ink">{fmt.usd(data.total_usd)}</span>
          </span>
          <span>
            Kept <span className="tabular-nums text-ink">{fmt.usd(data.kept_usd)}</span>
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-2" title={data.formula}>
          <div className="h-full rounded-full bg-gold" style={{ width: `${pct * 100}%` }} />
        </div>
        <p className="mt-2 text-[11px] text-muted">{data.formula}</p>
        {data.errors.length > 0 && <p className="mt-2 text-xs text-verdict-downtime">{data.errors.join("; ")}</p>}
      </section>

      <div className="grid gap-4 lg:grid-cols-3" data-testid="plan-lines">
        {lines.map((l) => (
          <article key={l.action_type_id} className="card flex flex-col p-4">
            <p className="text-xs uppercase tracking-wider text-muted">{l.action_type_id}</p>
            <h2 className="font-display text-lg font-semibold">{l.name}</h2>
            <p className="mt-1 text-sm">
              <span className="tabular-nums text-gold-soft">{fmt.usd(l.cost_usd)}</span>
              <span className="text-muted"> · qty {l.quantity}</span>
            </p>
            <p className="mt-1 text-xs text-muted">Targets: {l.targets}</p>
            <p className="mt-3 text-sm">{l.rationale}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              {(["lo", "mid", "hi"] as const).map((k) => (
                <div key={k} className="rounded-lg border border-rule bg-surface-2 p-1.5">
                  <dt className="text-muted">{k === "lo" ? "Low" : k === "mid" ? "Mid" : "High"}</dt>
                  <dd className="tabular-nums">{fmt.usdK(l[`effect_${k}_usd`])}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-[11px] text-muted">Theo over live days in the horizon. {l.uncertainty}</p>
            <p className="mt-3 text-xs">
              <span className="font-semibold text-ink">Measure: </span>
              <span className="text-muted">{l.measurement}</span>
            </p>
            <div className="mt-auto pt-3">
              <Evidence href={l.evidence} />
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">
        Plan total effect: {fmt.usdK(data.effect.lo)} – {fmt.usdK(data.effect.hi)} theo (mid {fmt.usdK(data.effect.mid)}) within 30 days;
        replacements keep paying after the horizon. Interactive allocator and sensitivity arrive with the M11 optimizer.
      </p>
    </div>
  );
}
