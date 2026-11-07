import { CheckCircle2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { AssertionTitle } from "../components/AssertionTitle";
import { ChartCard } from "../components/ChartCard";
import { ErrorNote, Loading } from "../components/Loading";
import { rows, type Columnar } from "../lib/data";
import { fmt } from "../lib/format";
import { useJson } from "../lib/useData";
import { colors } from "../theme/tokens";

const Chart = lazy(() => import("../components/Chart").then((m) => ({ default: m.Chart })));

type Lab = {
  split: Record<string, string>;
  model2: {
    mae_model: number;
    mae_weekday_only: number;
    mae_baseline: number;
    wape_model: number;
    wape_baseline: number;
    improvement_pct: number;
    event_uplift: number;
    bias_model: number;
    peak_days: string[];
    trough_days: string[];
  };
  model2_holdout: Columnar;
  model1: {
    mae_model: number;
    mae_baseline: number;
    wmape_model: number;
    wmape_baseline: number;
    bias_model: number;
    improvement_pct: number;
    best_iteration: number;
    n_train: number;
    n_test: number;
    importance: Record<string, number>;
  } | null;
  persistence: {
    n: number;
    spearman: number;
    spearman_lo: number;
    spearman_hi: number;
    precision_at_k: number;
    precision_lo: number;
    precision_hi: number;
    k: number;
    random_precision: number;
  } | null;
  model1_change: {
    truly_weak_before: number;
    truly_weak_after: number;
    themes_before: number;
    themes_after: number;
    overlap_before: number;
    overlap_after: number;
    our10_kept: number;
  } | null;
};

const FEATURE_LABELS: Record<string, string> = {
  zone_id: "Zone",
  local_weekday: "Weekday",
  max_bet_usd: "Max bet",
  min_bet_usd: "Min bet",
  hit_probability: "Hit probability",
  configured_rtp: "Configured RTP",
  is_weekend: "Weekend",
  entrance_path_m: "Walk from entrance (closures)",
  event: "Citywide event",
  day_index: "Trend (day)",
  bank_x: "Bank x",
  bank_y: "Bank y",
  dist_entrance_m: "Distance to door",
  max_multiplier: "Max multiplier",
  volatility_class: "Volatility",
  lease_class: "Lease class",
  end_cap: "End cap",
  bank_capacity: "Bank size",
  manufacturer: "Manufacturer",
  holiday: "Federal holiday",
};
type H = { gaming_date: string; actual: number; pred_model: number; pred_baseline: number };

const LEAKAGE = [
  "Train Jan–Apr, test May–Jun; nothing from the test window is used to fit",
  "Fitted parameters are unchanged when test-period outcomes are perturbed ×10",
  "Only events announced on or before the Apr 30 cutoff are used",
  "Lag features use prior days only (t−7…t−1)",
  "No real-world context data (LVCVA, weather) enters any model",
  "Machine location joined by date from placements, not a fixed snapshot",
];

export default function ModelLab() {
  const { data, error } = useJson<Lab>("model_lab.json");
  if (error) return <ErrorNote what="model results" error={error} />;
  if (!data) return <Loading />;
  const m = data.model2;
  const h = rows<H>(data.model2_holdout);
  const m1 = data.model1;
  const p = data.persistence;
  const ch = data.model1_change;
  const imp = m1 ? Object.entries(m1.importance).slice(0, 10).reverse() : [];

  return (
    <div>
      <AssertionTitle
        kicker="Model Lab · validation"
        sub={`Trained on ${data.split.train_end ? "Jan 1 – " + data.split.train_end : "Jan–Apr"}, scored on unseen days from ${data.split.test_start}. Every model is compared with a simple baseline.`}
      >
        {m1 && p
          ? `Location + game model cuts machine-day error ${fmt.pct(m1.improvement_pct, 0)}, and weak machines stay weak (ρ ${p.spearman.toFixed(2)})`
          : `A weekday + event forecast cuts daily coin-in error ${fmt.pct(m.improvement_pct, 0)} vs. a flat average`}
      </AssertionTitle>

      <TimelineSplit split={data.split} />

      {m1 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <section className="card p-4" aria-label="Model 1 error table" data-testid="mae-table-model1">
            <h2 className="text-sm font-semibold">Model 1 · expected coin-in per available hour</h2>
            <p className="mb-3 text-xs text-muted">
              LightGBM on location, game and calendar (no machine id, theme or lags); {m1.best_iteration} rounds chosen on April. Test{" "}
              {m1.n_test.toLocaleString()} machine-days, May–Jun.
            </p>
            <table className="w-full text-sm tabular-nums">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="py-1 font-medium">Per machine-day</th>
                  <th className="py-1 text-right font-medium">MAE</th>
                  <th className="py-1 text-right font-medium">WMAPE</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-rule">
                  <td className="py-1.5 text-gold-soft">Model 1</td>
                  <td className="py-1.5 text-right">{fmt.usd(m1.mae_model)}</td>
                  <td className="py-1.5 text-right">{fmt.pct(m1.wmape_model)}</td>
                </tr>
                <tr className="border-t border-rule">
                  <td className="py-1.5 text-muted">Baseline (zone × weekday)</td>
                  <td className="py-1.5 text-right">{fmt.usd(m1.mae_baseline)}</td>
                  <td className="py-1.5 text-right">{fmt.pct(m1.wmape_baseline)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">
              Runs {fmt.usd(m1.bias_model)}/machine-day high in May–Jun, the same post-April demand drift Model 2 sees. Scorecard
              expectations use out-of-fold predictions (a machine never sets its own baseline), scaled to same-zone peers each day.
            </p>
          </section>

          <ChartCard
            id="importance"
            title="What sets a machine's expected play"
            subtitle="Share of LightGBM gain, top 10 features"
            table={{ columns: ["Feature", "Gain share"], rows: imp.slice().reverse().map(([k, v]) => [FEATURE_LABELS[k] ?? k, fmt.pct(v)]) }}
          >
            <Suspense fallback={<div className="h-[260px]" />}>
              <Chart
                height={260}
                label="Bar chart of Model 1 feature importance"
                option={{
                  grid: { left: 150, right: 40, top: 4, bottom: 20 },
                  xAxis: { type: "value", axisLabel: { formatter: (v: number) => fmt.pct(v, 0) } },
                  yAxis: { type: "category", data: imp.map(([k]) => FEATURE_LABELS[k] ?? k) },
                  tooltip: { valueFormatter: (v) => fmt.pct(Number(v)) },
                  series: [{ type: "bar", data: imp.map(([, v]) => v), itemStyle: { color: colors.gold, borderRadius: [0, 3, 3, 0] } }],
                }}
              />
            </Suspense>
          </ChartCard>

          {p && (
            <section id="persistence" className="card p-4" aria-label="Rank persistence" data-testid="persistence">
              <h2 className="text-sm font-semibold">Do weak machines stay weak?</h2>
              <p className="mb-3 text-xs text-muted">
                Shrunk machine effect, Jan–Apr vs May–Jun, {p.n} machines with ≥ 14 days in each window. 90% intervals.
              </p>
              <dl className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-rule bg-surface-2 p-3">
                  <dt className="text-xs text-muted">Spearman rank correlation</dt>
                  <dd className="font-display text-2xl tabular-nums">{p.spearman.toFixed(2)}</dd>
                  <dd className="text-[11px] tabular-nums text-muted">
                    {p.spearman_lo.toFixed(2)}–{p.spearman_hi.toFixed(2)}
                  </dd>
                </div>
                <div className="rounded-lg border border-rule bg-surface-2 p-3">
                  <dt className="text-xs text-muted">Bottom {p.k} still bottom {p.k}</dt>
                  <dd className="font-display text-2xl tabular-nums">{fmt.pct(p.precision_at_k, 0)}</dd>
                  <dd className="text-[11px] tabular-nums text-muted">
                    {fmt.pct(p.precision_lo, 0)}–{fmt.pct(p.precision_hi, 0)} · random {fmt.pct(p.random_precision, 0)}
                  </dd>
                </div>
              </dl>
              {ch && (
                <div className="mt-4 rounded-lg border border-gold/40 bg-gold/5 p-3 text-xs">
                  <p className="font-semibold text-gold-soft">What this changed</p>
                  <p className="mt-1 text-ink">
                    Pricing game and walkway access into each spot cut &ldquo;truly weak&rdquo; from {ch.truly_weak_before} to{" "}
                    {ch.truly_weak_after} machines. Our list went from {ch.themes_before} themes to {ch.themes_after} ({ch.our10_kept} of 10
                    kept), and its overlap with the manager&rsquo;s list fell from {ch.overlap_before} to {ch.overlap_after}.
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ChartCard
          id="model2"
          title="Model 2 · daily floor coin-in: predicted vs. actual (test window)"
          subtitle="Model 2 = Jan–Apr weekday mean × citywide-event uplift; baseline = constant Jan–Apr daily mean"
          table={{
            columns: ["Date", "Actual", "Model", "Baseline"],
            rows: h.map((r) => [r.gaming_date, fmt.usd(r.actual), fmt.usd(r.pred_model), fmt.usd(r.pred_baseline)]),
          }}
        >
          <Suspense fallback={<div className="h-[300px]" />}>
            <Chart
              height={300}
              label="Line chart of actual and predicted daily coin-in for May and June 2025"
              option={{
                grid: { left: 64, right: 16, top: 28, bottom: 32 },
                legend: { top: 0, right: 0 },
                tooltip: { trigger: "axis", valueFormatter: (v) => fmt.usdK(Number(v)) },
                xAxis: { type: "time" },
                yAxis: { type: "value", axisLabel: { formatter: (v: number) => fmt.usdK(v) }, scale: true },
                series: [
                  { name: "Actual", type: "line", data: h.map((r) => [r.gaming_date, r.actual]), lineStyle: { color: colors.ink, width: 1.5 }, itemStyle: { color: colors.ink } },
                  { name: "Model 2", type: "line", data: h.map((r) => [r.gaming_date, r.pred_model]), lineStyle: { color: colors.gold }, itemStyle: { color: colors.gold } },
                  { name: "Baseline", type: "line", data: h.map((r) => [r.gaming_date, r.pred_baseline]), lineStyle: { color: colors.muted, type: "dashed" }, itemStyle: { color: colors.muted } },
                ],
              }}
            />
          </Suspense>
        </ChartCard>

        <section className="card p-4" aria-label="Model 2 error table" data-testid="mae-table">
          <h2 className="mb-3 text-sm font-semibold">Model 2 · test-window error (May–Jun, {h.length} days)</h2>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-1 font-medium">Model</th>
                <th className="py-1 text-right font-medium">MAE</th>
                <th className="py-1 text-right font-medium">WAPE</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-rule">
                <td className="py-1.5 text-gold-soft">Weekday × event</td>
                <td className="py-1.5 text-right">{fmt.usdK(m.mae_model)}</td>
                <td className="py-1.5 text-right">{fmt.pct(m.wape_model)}</td>
              </tr>
              <tr className="border-t border-rule">
                <td className="py-1.5">Weekday only</td>
                <td className="py-1.5 text-right">{fmt.usdK(m.mae_weekday_only)}</td>
                <td className="py-1.5 text-right">–</td>
              </tr>
              <tr className="border-t border-rule">
                <td className="py-1.5 text-muted">Baseline (flat mean)</td>
                <td className="py-1.5 text-right">{fmt.usdK(m.mae_baseline)}</td>
                <td className="py-1.5 text-right">{fmt.pct(m.wape_baseline)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">
            Event uplift ×{m.event_uplift.toFixed(3)}. Peaks {m.peak_days.join("/")}, troughs {m.trough_days.join("/")}. The model runs{" "}
            {fmt.usdK(m.bias_model)}/day high in May–Jun: demand drifted down after April.
          </p>
          <div className="mt-4 rounded-lg border border-gold/40 bg-gold/5 p-3 text-xs">
            <p className="font-semibold text-gold-soft">What this changed</p>
            <p className="mt-1 text-ink">
              Staff and time promotions to {m.peak_days.join("/")} peaks, not a flat schedule; re-fit monthly because of the downward drift.
            </p>
          </div>
        </section>
      </div>

      <section className="card mt-4 p-4" aria-label="Leakage checklist">
        <h2 className="mb-2 text-sm font-semibold">Leakage checklist (each is an automated test)</h2>
        <ul className="grid gap-1.5 text-sm md:grid-cols-2">
          {LEAKAGE.map((t) => (
            <li key={t} className="flex items-start gap-2">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-gold" aria-label="passes" />
              {t}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function TimelineSplit({ split }: { split: Record<string, string> }) {
  const seg = [
    { label: "Train (Model 1 inner)", from: "Jan 1", to: "Mar 31", cls: "bg-maroon", w: 90 },
    { label: "Validate (hyperparameters)", from: "Apr 1", to: "Apr 30", cls: "bg-maroon-hover", w: 30 },
    { label: "Test (never used to fit)", from: split.test_start, to: "Jun 30", cls: "bg-gold/70", w: 61 },
  ];
  return (
    <div aria-label="Train, validate and test timeline">
      <div className="flex h-8 overflow-hidden rounded-lg border border-rule">
        {seg.map((s) => (
          <div key={s.label} className={`${s.cls} flex items-center px-2 text-[11px] font-medium text-ink`} style={{ flex: s.w }}>
            {s.label}
          </div>
        ))}
      </div>
      <div className="mt-1 flex text-[10px] text-muted">
        {seg.map((s) => (
          <div key={s.label} style={{ flex: s.w }}>
            {s.from} – {s.to}
          </div>
        ))}
      </div>
    </div>
  );
}
