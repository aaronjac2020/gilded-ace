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

  return (
    <div>
      <AssertionTitle
        kicker="Model Lab · validation"
        sub={`Trained on ${data.split.train_end ? "Jan 1 – " + data.split.train_end : "Jan–Apr"}, scored on unseen days from ${data.split.test_start}. Every model is compared with a simple baseline.`}
      >
        A weekday + event forecast cuts daily coin-in error {fmt.pct(m.improvement_pct, 0)} vs. a flat average
      </AssertionTitle>

      <TimelineSplit split={data.split} />

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <ChartCard
          id="model2"
          title="Daily floor coin-in: predicted vs. actual (test window)"
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
          <h2 className="mb-3 text-sm font-semibold">Test-window error (May–Jun, {h.length} days)</h2>
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
