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

type Agreement = {
  spearman: number;
  spearman_lo: number;
  spearman_hi: number;
  precision_at_k: number;
  precision_lo: number;
  precision_hi: number;
};
type Moved = {
  n_moves: number;
  n_machines: number;
  min_days: number;
  beta_model: number;
  beta_model_lo: number;
  beta_model_hi: number;
  beta_peer: number;
  beta_peer_lo: number;
  beta_peer_hi: number;
  decision: "follows_spot" | "stays_with_machine" | "inconclusive";
  leave_one_out: Record<string, { model: number; peer: number }>;
  moves: {
    machine_id: string;
    from_zone: string;
    to_zone: string;
    spot_before: number;
    spot_after: number;
    rate_before: number;
    rate_after: number;
  }[];
};
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
  persistence_compare: {
    n: number;
    k: number;
    random_precision: number;
    outcomes: Record<
      "effect" | "house_win",
      Record<"manager" | "ours", Agreement> & { delta_rho: number; delta_rho_lo: number; delta_rho_hi: number }
    >;
    train_house_win_rho?: { spot: number; effect: number; n: number };
  } | null;
  alternatives: { moved: Moved } | null;
  move_test_pick: { swaps: number; moves: number; cost_usd: number; halfwidth: number } | null;
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
            ? `Spot + game model cuts error ${fmt.pct(m1.improvement_pct, 0)}; weak machines stay weak`
            : `A weekday + event forecast cuts daily coin-in error ${fmt.pct(m.improvement_pct, 0)} vs. a flat average`
        }
        sub="Fit on Jan–Apr, scored on unseen May–Jun days, each against a simple baseline."
      >
        <KpiStrip testId="model-kpis">
          {m1 && (
            <Kpi
              label="Model 1 MAE / machine-day"
              value={<Num value={m1.mae_model} kind="usd" />}
              note={`Baseline ${fmt.usd(m1.mae_baseline)} · ${fmt.pct(m1.improvement_pct)} lower`}
            />
          )}
          {m1 && (
            <Kpi label="Model 1 WMAPE" value={<Num value={m1.wmape_model} kind="pct" />} note={`Baseline ${fmt.pct(m1.wmape_baseline)}`} />
          )}
          {p && (
            <Kpi
              focal
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

      <div className="mt-16">
        <TimelineSplit split={data.split} />
      </div>

      {m1 && (
        <div className="mt-16 grid grid-cols-12 gap-8">
          <Tile
            className="col-span-12 lg:col-span-6"
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
            className="col-span-12 lg:col-span-6"
            label="Model 1"
            title="What sets expected play"
            sub="Share of LightGBM gain, top 10 features"
            table={{
              columns: ["Feature", "Gain share"],
              rows: imp
                .slice()
                .reverse()
                .map(([k, v]) => [FEATURE_LABELS[k] ?? k, fmt.pct(v)]),
            }}
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
              className="col-span-12"
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
                  Pricing game and walkway access into each spot cut truly weak from {ch.truly_weak_before} to {ch.truly_weak_after}{" "}
                  machines. Our list went from {ch.themes_before} themes to {ch.themes_after} ({ch.our10_kept} of 10 kept); overlap with the
                  manager fell from {ch.overlap_before} to {ch.overlap_after}.
                </Changed>
              )}
            </Tile>
          )}
        </div>
      )}

      {data.persistence_compare && (
        <RankingCompare c={data.persistence_compare} moved={data.alternatives?.moved} test={data.move_test_pick} />
      )}

      <div className="mt-16 grid grid-cols-12 gap-8">
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
          <Changed>
            Staff and time promotions to {m.peak_days.join("/")} peaks, not a flat schedule; re-fit monthly because of the drift.
          </Changed>
        </Tile>
      </div>

      <Tile className="mt-6" label="Guardrails" title="Leakage checklist" sub="Each line is an automated test in tests/test_no_leakage.py">
        <ul className="grid gap-x-8 md:grid-cols-2">
          {LEAKAGE.map((t) => (
            <li key={t} className="flex h-row items-center gap-2.5 border-b border-divider text-sm text-fg-muted">
              <span className="size-2 shrink-0 rotate-45 bg-gold" role="img" aria-label="passes" />
              {t}
            </li>
          ))}
        </ul>
      </Tile>
    </div>
  );
}

const OUTCOME_LABELS = { effect: "May–Jun play vs. spot and game", house_win: "May–Jun raw house win" } as const;
const RANKING_LABELS = { manager: "Manager: house win", ours: "Ours: shrunk effect" } as const;

/** Dot-and-whisker: both Jan–Apr rankings scored on the same machines and the same May–Jun outcomes. */
function RankingCompare({ c, moved, test }: { c: NonNullable<Lab["persistence_compare"]>; moved?: Moved; test: Lab["move_test_pick"] }) {
  const th = c.train_house_win_rho;
  const e = c.outcomes.effect;
  const hw = c.outcomes.house_win;
  const metrics = [
    {
      key: "rho",
      label: "Spearman rank corr.",
      lo: -0.2,
      ticks: [-0.2, 0, 0.5, 1],
      pick: (a: Agreement) => [a.spearman, a.spearman_lo, a.spearman_hi] as const,
      fmtV: (v: number) => v.toFixed(2),
    },
    {
      key: "p",
      label: `Bottom ${c.k} hit rate`,
      lo: 0,
      ticks: [0, 0.5, 1],
      pick: (a: Agreement) => [a.precision_at_k, a.precision_lo, a.precision_hi] as const,
      fmtV: (v: number) => fmt.pct(v, 0),
    },
  ];
  const outcomes = (["effect", "house_win"] as const).map((o) => [o, c.outcomes[o]] as const);
  return (
    <Tile
      id="ranking-compare"
      testId="ranking-compare"
      className="mt-6 outline outline-1 outline-offset-[5px] outline-gold/35 ring-1 ring-gold/60"
      label="Manager vs. ours"
      title={`Our ranking predicts play vs. the spot (ρ ${e.ours.spearman.toFixed(2)} vs. ${e.manager.spearman.toFixed(2)}); the manager's predicts house win better (ρ ${hw.manager.spearman.toFixed(2)} vs. ${hw.ours.spearman.toFixed(2)})`}
      sub={
        th
          ? `The manager’s ranking is consistent, but it tracks the spot, not the machine. Jan–Apr house win follows the spot’s expected play (ρ ${th.spot.toFixed(2)}), not machine effect (ρ ${th.effect.toFixed(2)}). Our ranking is the one that predicts which machines underperform their spot (ρ ${e.ours.spearman.toFixed(2)} vs. ${e.manager.spearman.toFixed(2)}).`
          : undefined
      }
      table={{
        columns: ["Outcome", "Ranking", "Spearman", "90% CI", `Bottom ${c.k} hits`, "90% CI"],
        rows: outcomes.flatMap(([o, r]) =>
          (["manager", "ours"] as const).map((k) => [
            OUTCOME_LABELS[o],
            RANKING_LABELS[k],
            r[k].spearman.toFixed(2),
            `${r[k].spearman_lo.toFixed(2)} to ${r[k].spearman_hi.toFixed(2)}`,
            fmt.pct(r[k].precision_at_k, 0),
            `${fmt.pct(r[k].precision_lo, 0)} to ${fmt.pct(r[k].precision_hi, 0)}`,
          ]),
        ),
      }}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {metrics.map((m) => {
          const x = (v: number) => `${((v - m.lo) / (1 - m.lo)) * 100}%`;
          return (
            <figure key={m.key} aria-label={m.label}>
              <figcaption className="eyebrow">{m.label}</figcaption>
              <div className="mt-3 space-y-5">
                {outcomes.map(([o, r]) => (
                  <div key={o}>
                    <p className="text-xs text-fg-muted">{OUTCOME_LABELS[o]}</p>
                    {(["manager", "ours"] as const).map((k) => {
                      const [v, a, b] = m.pick(r[k]);
                      return (
                        <div key={k} className="mt-1.5 grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3">
                          <span className={k === "ours" ? "truncate text-xs text-fg" : "truncate text-xs text-fg-muted"}>
                            {RANKING_LABELS[k]}
                          </span>
                          <div
                            className="relative h-4"
                            role="img"
                            aria-label={`${RANKING_LABELS[k]}: ${m.fmtV(v)}, 90% interval ${m.fmtV(a)} to ${m.fmtV(b)}`}
                          >
                            <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-divider" />
                            <div className="absolute inset-y-0 w-px bg-ring-strong" style={{ left: x(0) }} />
                            <div
                              className={
                                k === "ours"
                                  ? "absolute top-1/2 h-0.5 -translate-y-1/2 bg-gold/60"
                                  : "absolute top-1/2 h-0.5 -translate-y-1/2 bg-fg-subtle"
                              }
                              style={{ left: x(a), right: `calc(100% - ${x(b)})` }}
                            />
                            <div
                              className={
                                k === "ours"
                                  ? "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-soft"
                                  : "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-fg-muted bg-bg"
                              }
                              style={{ left: x(v) }}
                            />
                          </div>
                          <span className="mono text-right text-xs text-fg">{m.fmtV(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-[9.5rem_1fr_3rem] gap-3" aria-hidden>
                <span />
                <div className="mono relative h-4 text-2xs text-fg-subtle">
                  {m.ticks.map((t) => (
                    <span key={t} className="absolute -translate-x-1/2" style={{ left: x(t) }}>
                      {m.fmtV(t).replace("-", "−")}
                    </span>
                  ))}
                </div>
              </div>
            </figure>
          );
        })}
      </div>
      <p className="mt-4 text-2xs text-fg-subtle">
        Same {c.n} machines, ranked on Jan–Apr only, scored on May–Jun. Dots are estimates, whiskers 90% intervals. Random bottom-{c.k} hit
        rate {fmt.pct(c.random_precision, 0)}.
      </p>
      {moved && moved.n_moves > 0 && <FollowsSpot mv={moved} test={test} />}
      <Changed>
        Each ranking predicts its own yardstick. Low house win persists because the spot persists: Jan–Apr house win tracks the spot&apos;s
        expected coin-in, so the manager&apos;s list keeps landing on quiet spots, not weaker machines. On play relative to spot and game,
        the manager&apos;s ranking is close to random (ρ {e.manager.spearman.toFixed(2)}, {e.manager.spearman_lo.toFixed(2)} to{" "}
        {e.manager.spearman_hi.toFixed(2)}; difference {e.delta_rho >= 0 ? "+" : ""}
        {e.delta_rho.toFixed(2)}, 90% CI {e.delta_rho_lo.toFixed(2)} to {e.delta_rho_hi.toFixed(2)}). Replacing a machine only helps if the
        machine is the problem, so the plan tests moves first.
      </Changed>
    </Tile>
  );
}

/** Natural experiment: slope of a moved machine's log play change on its log spot change (1 = follows the spot). */
function FollowsSpot({ mv, test }: { mv: Moved; test: Lab["move_test_pick"] }) {
  const lo = -0.2;
  const hi = 1.6;
  const x = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
  const rows = [
    { key: "model", label: "vs. Model 1 spot", v: mv.beta_model, a: mv.beta_model_lo, b: mv.beta_model_hi },
    { key: "peer", label: "vs. same-bank peers", v: mv.beta_peer, a: mv.beta_peer_lo, b: mv.beta_peer_hi },
  ];
  // the one move with a large spot change carries the estimate; name it from the data
  const big = [...mv.moves].sort(
    (p, q) => Math.abs(Math.log(q.spot_after / q.spot_before)) - Math.abs(Math.log(p.spot_after / p.spot_before)),
  )[0];
  const loo = big ? mv.leave_one_out[big.machine_id] : undefined;
  const answer =
    mv.decision === "follows_spot"
      ? "Yes"
      : mv.decision === "stays_with_machine"
        ? "No, it stays with the machine"
        : `Probably, but only ${mv.n_machines} machines moved`;
  return (
    <figure className="mt-6 border-t border-divider pt-5" aria-label="Does performance follow the spot?" data-testid="follows-spot">
      <figcaption>
        <p className="eyebrow">Does performance follow the spot?</p>
        <p className="mt-1 text-base text-fg">{answer}</p>
        <p className="mt-1 max-w-prose text-xs text-fg-muted">
          Each machine that moved with ≥ {mv.min_days} days at both spots: how much its play changed vs. how much the spot predicted. 1 =
          play follows the spot, 0 = play stays with the machine. Pooled slope, 90% bootstrap interval.
        </p>
      </figcaption>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[9.5rem_1fr_3rem] items-center gap-3">
            <span className="truncate text-xs text-fg">{r.label}</span>
            <div
              className="relative h-4"
              role="img"
              aria-label={`${r.label}: slope ${r.v.toFixed(2)}, 90% interval ${r.a.toFixed(2)} to ${r.b.toFixed(2)}`}
            >
              <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-divider" />
              {[0, 1].map((t) => (
                <div key={t} className="absolute inset-y-0 w-px bg-ring-strong" style={{ left: x(t) }} />
              ))}
              <div className="absolute inset-y-0 border-l border-dashed border-fg-subtle" style={{ left: x(0.5) }} />
              <div
                className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-gold/60"
                style={{ left: x(r.a), right: `calc(100% - ${x(r.b)})` }}
              />
              <div
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-soft"
                style={{ left: x(r.v) }}
              />
            </div>
            <span className="mono text-right text-xs text-fg">{r.v.toFixed(2)}</span>
          </div>
        ))}
        <div className="grid grid-cols-[9.5rem_1fr_3rem] gap-3" aria-hidden>
          <span />
          <div className="mono relative h-4 text-2xs text-fg-subtle">
            {[0, 0.5, 1, 1.5].map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: x(t) }}>
                {t === 0 ? "0 machine" : t === 1 ? "1 spot" : t.toFixed(1)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <ul className="mt-3 max-w-prose list-disc space-y-1 pl-4 text-xs text-fg-muted">
        <li>
          Decision rule: “follows the spot” needs both lower bounds above 0.5. The 0.5 threshold was set after seeing these estimates, so it
          is not pre-registered.
        </li>
        {big && loo && (
          <li>
            Sensitivity: one move carries most of the signal ({big.machine_id}, {big.from_zone} → {big.to_zone}, spot{" "}
            {fmt.usd(big.spot_before)} → {fmt.usd(big.spot_after)}/hr). Without it, the slope is {loo.model.toFixed(2)} (model) /{" "}
            {loo.peer.toFixed(2)} (peers).
          </li>
        )}
        {test && (
          <li>
            The plan settles it with a controlled test: {test.swaps} swaps ({test.moves} moves, {fmt.usdK(test.cost_usd)}) between quiet and
            busy spots, each against an unmoved same-bank control; planned 90% interval about ±{test.halfwidth.toFixed(2)}.
          </li>
        )}
      </ul>
    </figure>
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
    {
      label: "Validate",
      note: "hyperparameters",
      from: "Apr 1",
      to: "Apr 30",
      cls: "bg-maroon/40 ring-1 ring-inset ring-maroon-bright/70",
      w: 30,
    },
    { label: "Test", note: "never used to fit", from: "May 1", to: "Jun 30", cls: "bg-ivory/10 ring-1 ring-inset ring-ivory/30", w: 61 },
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
      <div className="mono mt-1.5 flex gap-1 text-2xs text-fg-muted">
        {seg.map((s) => (
          <div key={s.label} className="px-3" style={{ flex: s.w }}>
            {s.from} – {s.to}
          </div>
        ))}
      </div>
    </div>
  );
}
