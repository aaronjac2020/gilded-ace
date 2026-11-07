import { Check } from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { Num } from "../components/ui/num";
import { ErrorState, ScreenSkeleton, Skeleton } from "../components/ui/skeleton";
import { DataTable, Tile } from "../components/ui/tile";
import { rows, type Columnar } from "../lib/data";
import { fmt } from "../lib/format";
import { useJson } from "../lib/useData";
import { areaFill, tipHtml } from "../theme/echartsTheme";
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
  if (error) return <ErrorState what="model results" error={error} />;
  if (!data) return <ScreenSkeleton />;
  const m = data.model2;
  const h = rows<H>(data.model2_holdout);
  const m1 = data.model1;
  const p = data.persistence;
  const ch = data.model1_change;
  const imp = m1 ? Object.entries(m1.importance).slice(0, 10).reverse() : [];

  return (
    <div>
      <HeroBand
        className="-mx-6"
        eyebrow="Model lab · validation"
        title={
          m1 && p
            ? `Location + game model cuts machine-day error ${fmt.pct(m1.improvement_pct, 0)}, and weak machines stay weak`
            : `A weekday + event forecast cuts daily coin-in error ${fmt.pct(m.improvement_pct, 0)} vs. a flat average`
        }
        sub="Fit on January to April, scored on unseen May and June days. Every model is measured against a simple baseline."
      >
        <KpiStrip testId="model-kpis">
          {m1 && (
            <Kpi
              focal
              label="Model 1 MAE / machine-day"
              value={<Num value={m1.mae_model} kind="usd" />}
              note={`Baseline ${fmt.usd(m1.mae_baseline)} · ${fmt.pct(m1.improvement_pct)} lower`}
            />
          )}
          {m1 && <Kpi label="Model 1 WMAPE" value={<Num value={m1.wmape_model} kind="pct" />} note={`Baseline ${fmt.pct(m1.wmape_baseline)}`} />}
          {p && (
            <Kpi
              label="Rank persistence, Spearman"
              value={<Num value={p.spearman} kind="dec" />}
              note={`90% CI ${p.spearman_lo.toFixed(2)}–${p.spearman_hi.toFixed(2)}, ${p.n} machines`}
            />
          )}
          <Kpi
            label="Model 2 MAE / day"
            value={<Num value={m.mae_model} kind="usdCompact" />}
            note={`Baseline ${fmt.usdK(m.mae_baseline)} · ${fmt.pct(m.improvement_pct)} lower`}
          />
        </KpiStrip>
      </HeroBand>

      <div className="mt-8">
        <TimelineSplit split={data.split} />
      </div>

      {m1 && (
        <div className="mt-6 grid grid-cols-12 gap-6">
          <Tile
            className="col-span-12 lg:col-span-4"
            label="Model 1"
            title="Expected coin-in per available hour"
            sub={`LightGBM on location, game and calendar. No machine ID, theme or lags. ${m1.best_iteration} rounds chosen on April.`}
            testId="mae-table-model1"
            footer={<p className="text-2xs text-fg-subtle">Test: {m1.n_test.toLocaleString()} machine-days, May–Jun</p>}
          >
            <DataTable
              t={{
                columns: ["Per machine-day", "MAE", "WMAPE"],
                rows: [
                  ["Model 1", fmt.usd(m1.mae_model), fmt.pct(m1.wmape_model)],
                  ["Baseline (zone × weekday)", fmt.usd(m1.mae_baseline), fmt.pct(m1.wmape_baseline)],
                ],
              }}
            />
            <p className="mt-3 text-xs text-fg-muted">
              Runs {fmt.usd(m1.bias_model)}/machine-day high in May–Jun, the same post-April drift Model 2 sees. Scorecard expectations use
              out-of-fold predictions, so a machine never sets its own baseline.
            </p>
          </Tile>

          <Tile
            id="importance"
            className="col-span-12 lg:col-span-4"
            label="Model 1"
            title="What sets expected play"
            sub="Share of LightGBM gain, top 10 features"
            table={{ columns: ["Feature", "Gain share"], rows: imp.slice().reverse().map(([k, v]) => [FEATURE_LABELS[k] ?? k, fmt.pct(v)]) }}
          >
            <Suspense fallback={<Skeleton className="h-[260px] w-full" />}>
              <Chart
                height={260}
                label="Bar chart of Model 1 feature importance"
                option={{
                  grid: { left: 4, right: 40, top: 0, bottom: 0, containLabel: true },
                  xAxis: { type: "value", show: false },
                  yAxis: { type: "category", data: imp.map(([k]) => FEATURE_LABELS[k] ?? k), axisLabel: { color: colors["fg-muted"] } },
                  tooltip: {
                    trigger: "item",
                    formatter: (q: unknown) => {
                      const d = q as { name: string; value: number };
                      return tipHtml(d.name, [["Gain share", fmt.pct(d.value)]]);
                    },
                  },
                  series: [
                    {
                      type: "bar",
                      barWidth: 10,
                      data: imp.map(([, v], i) => ({
                        value: v,
                        itemStyle: { color: i === imp.length - 1 ? colors.gold : colors["fg-subtle"], borderRadius: [0, 3, 3, 0] },
                      })),
                      label: {
                        show: true,
                        position: "right",
                        color: colors["fg-muted"],
                        fontSize: 11,
                        formatter: (q: { value?: unknown }) => fmt.pct(Number(q.value), 0),
                      },
                    },
                  ],
                }}
              />
            </Suspense>
          </Tile>

          {p && (
            <Tile
              id="persistence"
              className="col-span-12 lg:col-span-4"
              label="Stability"
              title="Do weak machines stay weak?"
              sub={`Shrunk effect, Jan–Apr vs. May–Jun. ${p.n} machines with 14+ days in each window.`}
              testId="persistence"
            >
              <dl className="grid grid-cols-2 divide-x divide-divider">
                <div className="pr-4">
                  <dt className="eyebrow">Spearman rank corr.</dt>
                  <dd className="display mt-1 text-3xl text-fg">
                    <Num value={p.spearman} kind="dec" />
                  </dd>
                  <dd className="mono text-2xs text-fg-muted">
                    {p.spearman_lo.toFixed(2)}–{p.spearman_hi.toFixed(2)}
                  </dd>
                </div>
                <div className="pl-4">
                  <dt className="eyebrow">
                    Bottom {p.k} stays bottom {p.k}
                  </dt>
                  <dd className="display mt-1 text-3xl text-fg">
                    <Num value={p.precision_at_k} kind="pct" />
                  </dd>
                  <dd className="mono text-2xs text-fg-muted">
                    {fmt.pct(p.precision_lo, 0)}–{fmt.pct(p.precision_hi, 0)} · random {fmt.pct(p.random_precision, 0)}
                  </dd>
                </div>
              </dl>
              {ch && (
                <Changed>
                  Pricing game and walkway access into each spot cut truly weak from {ch.truly_weak_before} to {ch.truly_weak_after} machines.
                  Our list went from {ch.themes_before} themes to {ch.themes_after} ({ch.our10_kept} of 10 kept); overlap with the manager fell
                  from {ch.overlap_before} to {ch.overlap_after}.
                </Changed>
              )}
            </Tile>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-12 gap-6">
        <Tile
          id="model2"
          className="col-span-12 lg:col-span-8"
          label="Model 2"
          title="Daily floor coin-in, test window"
          sub="Jan–Apr weekday mean × citywide-event uplift, against a flat Jan–Apr mean"
          table={{
            columns: ["Date", "Actual", "Model", "Baseline"],
            rows: h.map((r) => [r.gaming_date, fmt.usd(r.actual), fmt.usd(r.pred_model), fmt.usd(r.pred_baseline)]),
          }}
        >
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <Chart
              height={300}
              label="Line chart of actual and predicted daily coin-in for May and June 2025"
              option={{
                grid: { left: 4, right: 72, top: 12, bottom: 4, containLabel: true },
                tooltip: {
                  trigger: "axis",
                  formatter: (q: unknown) => {
                    const a = q as { axisValueLabel: string; seriesName: string; value: [string, number]; color: string }[];
                    return tipHtml(
                      a[0]?.axisValueLabel ?? "",
                      a.map((s) => [s.seriesName, fmt.usdK(s.value[1]), s.color]),
                    );
                  },
                },
                xAxis: { type: "time", axisLabel: { formatter: "{MMM} {d}" } },
                yAxis: { type: "value", axisLabel: { formatter: (v: number) => fmt.usdK(v) }, scale: true },
                series: [
                  {
                    name: "Actual",
                    type: "line",
                    data: h.map((r) => [r.gaming_date, r.actual]),
                    lineStyle: { color: colors["fg-muted"], width: 1.25 },
                    itemStyle: { color: colors["fg-muted"] },
                    areaStyle: { color: areaFill(colors["fg-muted"], 0.12) },
                    endLabel: { show: true, formatter: "Actual", color: colors["fg-muted"], fontSize: 11 },
                  },
                  {
                    name: "Model 2",
                    type: "line",
                    data: h.map((r) => [r.gaming_date, r.pred_model]),
                    lineStyle: { color: colors.gold, width: 1.75 },
                    itemStyle: { color: colors.gold },
                    endLabel: { show: true, formatter: "Model 2", color: colors["gold-soft"], fontSize: 11 },
                  },
                  {
                    name: "Baseline",
                    type: "line",
                    data: h.map((r) => [r.gaming_date, r.pred_baseline]),
                    lineStyle: { color: colors["fg-subtle"], type: [4, 4], width: 1 },
                    itemStyle: { color: colors["fg-subtle"] },
                    endLabel: { show: true, formatter: "Baseline", color: colors["fg-subtle"], fontSize: 11 },
                  },
                ],
              }}
            />
          </Suspense>
        </Tile>

        <Tile className="col-span-12 lg:col-span-4" label="Model 2" title={`Test-window error, ${h.length} days`} testId="mae-table">
          <DataTable
            t={{
              columns: ["Model", "MAE", "WAPE"],
              rows: [
                ["Weekday × event", fmt.usdK(m.mae_model), fmt.pct(m.wape_model)],
                ["Weekday only", fmt.usdK(m.mae_weekday_only), "–"],
                ["Baseline (flat mean)", fmt.usdK(m.mae_baseline), fmt.pct(m.wape_baseline)],
              ],
            }}
          />
          <p className="mt-3 text-xs text-fg-muted">
            Event uplift ×{m.event_uplift.toFixed(3)}. Peaks {m.peak_days.join("/")}, troughs {m.trough_days.join("/")}. Runs{" "}
            {fmt.usdK(m.bias_model)}/day high in May–Jun: demand drifted down after April.
          </p>
          <Changed>Staff and time promotions to {m.peak_days.join("/")} peaks, not a flat schedule; re-fit monthly because of the drift.</Changed>
        </Tile>
      </div>

      <Tile className="mt-6" label="Guardrails" title="Leakage checklist" sub="Each line is an automated test in tests/test_no_leakage.py">
        <ul className="grid gap-x-8 md:grid-cols-2">
          {LEAKAGE.map((t) => (
            <li key={t} className="flex h-row items-center gap-2.5 border-b border-divider text-sm text-fg-muted">
              <Check size={14} className="shrink-0 text-gold" aria-label="passes" />
              {t}
            </li>
          ))}
        </ul>
      </Tile>
    </div>
  );
}

function Changed({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 rounded-md bg-gold/[0.06] p-3 ring-1 ring-inset ring-gold/20">
      <p className="eyebrow !text-gold-soft">What this changed</p>
      <p className="mt-1 text-sm text-fg">{children}</p>
    </div>
  );
}

function TimelineSplit(_: { split: Record<string, string> }) {
  const seg = [
    { label: "Train", note: "Model 1 inner fit", from: "Jan 1", to: "Mar 31", cls: "bg-surface-3", w: 90 },
    { label: "Validate", note: "hyperparameters", from: "Apr 1", to: "Apr 30", cls: "bg-maroon", w: 30 },
    { label: "Test", note: "never used to fit", from: "May 1", to: "Jun 30", cls: "bg-gold/20 ring-1 ring-inset ring-gold/40", w: 61 },
  ];
  return (
    <div aria-label="Train, validate and test timeline">
      <div className="flex h-8 gap-1">
        {seg.map((s) => (
          <div key={s.label} className={`${s.cls} flex items-center gap-2 rounded-sm px-3 text-xs`} style={{ flex: s.w }}>
            <span className="font-medium text-fg">{s.label}</span>
            <span className="hidden truncate text-fg-muted md:inline">{s.note}</span>
          </div>
        ))}
      </div>
      <div className="mono mt-1.5 flex gap-1 text-2xs text-fg-subtle">
        {seg.map((s) => (
          <div key={s.label} className="px-3" style={{ flex: s.w }}>
            {s.from} – {s.to}
          </div>
        ))}
      </div>
    </div>
  );
}
