import { lazy, Suspense, useMemo } from "react";
import { EvidenceLink } from "../components/EvidenceLink";
import { PERIOD_LONG } from "../components/shell/nav";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { Num } from "../components/ui/num";
import { ErrorState, ScreenSkeleton, Skeleton } from "../components/ui/skeleton";
import { Tile } from "../components/ui/tile";
import { rows, type Columnar } from "../lib/data";
import { fmt } from "../lib/format";
import { useFilters } from "../lib/urlState";
import { useJson } from "../lib/useData";
import { tipHtml } from "../theme/echartsTheme";
import { colors } from "../theme/tokens";
import { Evidence, Lead } from "../components/ui/more";

const Chart = lazy(() => import("../components/Chart").then((m) => ({ default: m.Chart })));

type Week = {
  week: string;
  theo: number;
  coin_in: number;
  comp_cost: number;
  comp_face: number;
  redemptions: number;
  points_redeemed: number;
  points_earned: number;
  reinvestment: number;
  earn_rate: number;
  points_per_dollar: number;
  cost_per_face: number;
};
type Cp = {
  k: number;
  effect: number;
  before: number;
  after: number;
  effect_lo: number;
  effect_hi: number;
  within_1wk: number;
  null_effect_p95: number;
  p_null: number;
  p_perm: number;
  n_perm: number;
  week: string;
  week_lo: string;
  week_hi: string;
};
type SegRow = {
  month: string;
  tier: string;
  region: string;
  comp_cost: number;
  comp_face: number;
  theo: number;
  redemptions: number;
  redeemers: number;
  players: number;
};
type CompsData = {
  weekly: Columnar;
  change_points: Record<"reinvestment" | "points_per_dollar" | "earn_rate" | "cost_per_face", Cp>;
  by_segment: Columnar;
  fnb: {
    paid_cash: number;
    paid_cogs: number;
    comped_cogs: number;
    comped_face: number;
    ledger_cost: number;
    all_cogs: number;
  };
  notes: Record<string, string>;
};

const MONTHS = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const PERIOD_MONTHS: Record<string, string[]> = {
  full: MONTHS,
  train: MONTHS.slice(0, 4),
  test: MONTHS.slice(4),
};
const TIERS = ["Base", "Gold", "Platinum"];
const TIER_COLOR: Record<string, string> = {
  Base: "#5A5150",
  Gold: colors.gold,
  Platinum: "#D9D4D3",
};

const pp = (x: number, d = 2) => `${(x * 100).toFixed(d)}%`;
const shortDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

/** Permutation p to 3 decimals, floored at the test's resolution. */
const pval = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));
export default function Comps() {
  const { data, error } = useJson<CompsData>("comps.json");
  const [f] = useFilters();
  const v = useMemo(() => (data ? derive(data, f.period) : null), [data, f.period]);
  if (error) return <ErrorState what="comps" error={error} />;
  if (!data || !v) return <ScreenSkeleton />;
  const label = PERIOD_LONG[f.period] ?? f.period;
  const cp = data.change_points.reinvestment;
  const ppd = data.change_points.points_per_dollar;
  const earn = data.change_points.earn_rate;
  const rel = cp.effect / cp.before;

  return (
    <div>
      <HeroBand
        className="-mx-6"
        eyebrow={`Comps · ${label}`}
        title={
          <>
            A comp dollar takes {ppd.after.toFixed(1)} points, not {ppd.before.toFixed(1)}; cost rose {pp(cp.before)} → {pp(cp.after)} of
            theo
          </>
        }
        sub={`Price change week of ${shortDate(ppd.week)} (cost step ${shortDate(cp.week)}). Earning held at ${earn.before.toFixed(2)} points per $ wagered, so each point bought more.`}
      >
        <KpiStrip testId="comps-kpis">
          <Kpi
            label="Comp cost"
            value={<Num value={v.cost} kind="usdCompact" />}
            note={`Economic cost; face value ${fmt.usdK(v.face)}`}
            focal
          />
          <Kpi label="Reinvestment rate" value={pp(v.rate)} note="Comp cost ÷ carded theo" />
          <Kpi
            label="Redemptions"
            value={<Num value={v.redemptions} kind="int" />}
            note={`${fmt.int(v.redeemers)} player-months redeemed`}
          />
          <Kpi label="Cost per $ of face" value={`${(v.face ? v.cost / v.face : 0).toFixed(2)}`} note="What a $1 comp costs the property" />
        </KpiStrip>
      </HeroBand>

      <section id="change-point" aria-label="Change point" className="mt-16 scroll-mt-20">
        <Tile
          hero
          label="Change point"
          title={`One break in weekly reinvestment: ${shortDate(cp.week)} (90% CI ${shortDate(cp.week_lo)} – ${shortDate(cp.week_hi)}), +${(cp.effect * 100).toFixed(2)} pts`}
          sub="Comp cost ÷ carded theo per full gaming week. Dashed lines: mean before and after the best single split; band: 90% interval on the date."
          table={{
            columns: ["Week of", "Comp cost", "Carded theo", "Reinvestment", "Points / $ redeemed"],
            rows: v.weeks.map((w) => [w.week, fmt.usd(w.comp_cost), fmt.usd(w.theo), pp(w.reinvestment), w.points_per_dollar.toFixed(1)]),
          }}
        >
          <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
            <Chart
              height={300}
              label={`Weekly comp reinvestment rate with a change point at ${cp.week}`}
              option={{
                grid: {
                  left: 4,
                  right: 72,
                  top: 28,
                  bottom: 4,
                  containLabel: true,
                },
                tooltip: {
                  trigger: "axis",
                  formatter: (q: unknown) => {
                    const a = q as { dataIndex: number }[];
                    const w = v.weeks[a[0].dataIndex];
                    return tipHtml(`Week of ${shortDate(w.week)}`, [
                      ["Reinvestment", pp(w.reinvestment)],
                      ["Comp cost", fmt.usdK(w.comp_cost)],
                      ["Carded theo", fmt.usdK(w.theo)],
                    ]);
                  },
                },
                xAxis: {
                  type: "category",
                  data: v.weeks.map((w) => shortDate(w.week)),
                  axisLabel: { interval: 3 },
                },
                yAxis: {
                  type: "value",
                  scale: true,
                  axisLabel: { formatter: (x: number) => pp(x, 2) },
                },
                series: [
                  {
                    type: "line",
                    data: v.weeks.map((w) => w.reinvestment),
                    lineStyle: { color: colors["gold-soft"], width: 2 },
                    itemStyle: { color: colors.gold },
                    symbolSize: 5,
                    markArea: {
                      silent: true,
                      itemStyle: { color: "rgba(201,130,46,0.12)" },
                      data: [[{ xAxis: shortDate(cp.week_lo) }, { xAxis: shortDate(cp.week_hi) }]] as never,
                    },
                    markLine: {
                      silent: true,
                      symbol: "none",
                      lineStyle: {
                        color: colors["fg-muted"],
                        type: "dashed",
                        width: 1,
                      },
                      label: {
                        color: colors["fg-muted"],
                        fontSize: 10,
                        formatter: "{b}",
                      },
                      data: [
                        [
                          {
                            name: `before ${pp(cp.before)}`,
                            coord: [0, cp.before],
                          },
                          { coord: [cp.k - 1, cp.before] },
                        ],
                        [
                          {
                            name: `after ${pp(cp.after)}`,
                            coord: [cp.k, cp.after],
                          },
                          { coord: [v.weeks.length - 1, cp.after] },
                        ],
                      ] as never,
                    },
                  },
                ],
              }}
            />
          </Suspense>
          <p className="mt-4 max-w-prose text-sm text-fg">
            Change point: week of <span className="mono text-fg">{cp.week}</span>, +{(cp.effect * 100).toFixed(2)} pts; permutation p ={" "}
            <span className="mono text-fg">{pval(cp.p_perm)}</span>.
          </p>
          <Evidence>
            <p className="max-w-prose" data-testid="change-point">
              Change point: week of <span className="mono text-fg">{cp.week}</span> (90% CI {cp.week_lo} to {cp.week_hi};{" "}
              {fmt.pct(cp.within_1wk, 0)} of resamples within a week). Effect:{" "}
              <span className="mono text-fg">+{(cp.effect * 100).toFixed(2)} pts</span> (90% CI +{(cp.effect_lo * 100).toFixed(2)} to +
              {(cp.effect_hi * 100).toFixed(2)}), a {fmt.pct(rel, 0)} rise in comp cost per dollar of theo. A split of a series with no
              break finds a shift this large {fmt.pct(cp.p_null, 0)} of the time. Shuffling the weeks {fmt.int(cp.n_perm)} times and
              re-running the full split search each time: permutation p = <span className="mono text-fg">{pval(cp.p_perm)}</span>.
            </p>
            <p className="max-w-prose text-2xs text-fg-subtle">{data.notes.change_point}</p>
          </Evidence>
        </Tile>
      </section>

      <div className="mt-8 grid grid-cols-12 gap-8">
        <Tile
          id="loyalty"
          className="col-span-12 scroll-mt-20 lg:col-span-7"
          label="Loyalty ledger"
          title={`Points got ${(ppd.before / ppd.after).toFixed(1)}× more valuable at redemption; earning did not change`}
          sub="Points redeemed per dollar of comp face value (dark) and points earned per dollar wagered (grey), weekly."
          table={{
            columns: ["Series", "Break week", "Before", "After", "Permutation p"],
            rows: (
              [
                ["Points per $ redeemed", ppd],
                ["Points earned per $ wagered", earn],
                ["Cost per $ of face", data.change_points.cost_per_face],
              ] as const
            ).map(([k, c]) => [k, c.week, c.before.toFixed(3), c.after.toFixed(3), pval(c.p_perm)]),
          }}
        >
          <Suspense fallback={<Skeleton className="h-[260px] w-full" />}>
            <Chart
              height={260}
              label="Weekly loyalty redemption price and earn rate"
              option={{
                grid: {
                  left: 4,
                  right: 4,
                  top: 48,
                  bottom: 4,
                  containLabel: true,
                },
                tooltip: {
                  trigger: "axis",
                  formatter: (q: unknown) => {
                    const a = q as { dataIndex: number }[];
                    const w = v.weeks[a[0].dataIndex];
                    return tipHtml(`Week of ${shortDate(w.week)}`, [
                      ["Points per $ redeemed", w.points_per_dollar.toFixed(1)],
                      ["Points earned per $", w.earn_rate.toFixed(3)],
                      ["Redemptions", fmt.int(w.redemptions)],
                    ]);
                  },
                },
                xAxis: {
                  type: "category",
                  data: v.weeks.map((w) => shortDate(w.week)),
                  axisLabel: { interval: 3 },
                },
                yAxis: [
                  {
                    type: "value",
                    min: 0,
                    name: "Redeemed per $",
                    nameTextStyle: {
                      align: "left",
                      color: colors["gold-soft"],
                    },
                    axisLabel: { formatter: (x: number) => x.toFixed(0) },
                  },
                  {
                    type: "value",
                    min: 0,
                    max: 1.5,
                    name: "Earned per $",
                    nameTextStyle: { align: "right", color: "#8A7F7E" },
                    splitLine: { show: false },
                    axisLabel: { formatter: (x: number) => x.toFixed(1) },
                  },
                ],
                series: [
                  {
                    name: "Points per $ redeemed",
                    type: "line",
                    step: "end",
                    data: v.weeks.map((w) => w.points_per_dollar),
                    lineStyle: { color: colors["gold-soft"], width: 2 },
                    itemStyle: { color: colors.gold },
                    symbol: "none",
                  },
                  {
                    name: "Points earned per $",
                    type: "line",
                    yAxisIndex: 1,
                    data: v.weeks.map((w) => w.earn_rate),
                    lineStyle: { color: "#8A7F7E", width: 1.5 },
                    itemStyle: { color: "#8A7F7E" },
                    symbol: "none",
                  },
                ],
              }}
            />
          </Suspense>
          <Lead className="mt-3 text-xs text-fg-muted">
            Redemptions went from about {fmt.int(v.redBefore)} to {fmt.int(v.redAfter)} a week, and comp cost per dollar of face value held
            at {data.change_points.cost_per_face.before.toFixed(2)}, so the mix of comps did not change. Cheaper points explain the step:
            the same play now buys more comps. [Synthetic data; the ledger does not record the reason.]
          </Lead>
        </Tile>

        <Tile
          id="tiers"
          className="col-span-12 scroll-mt-20 lg:col-span-5"
          label="By tier"
          title={v.tierTitle}
          sub={`Comp cost ÷ theo by opening tier, ${label}`}
          table={{
            columns: ["Tier", "Comp cost", "Theo", "Reinvestment", "Players (months)"],
            rows: v.tiers.map((t) => [t.tier, fmt.usd(t.cost), fmt.usd(t.theo), pp(t.cost / t.theo), fmt.int(t.players)]),
          }}
        >
          <ul className="flex flex-col gap-4">
            {v.tiers.map((t) => {
              const max = Math.max(...v.tiers.map((x) => x.cost / x.theo));
              return (
                <li key={t.tier} className="grid grid-cols-[72px_1fr_64px] items-center gap-3">
                  <span className="text-sm text-fg">{t.tier}</span>
                  <span
                    className="h-2 rounded-full"
                    style={{
                      width: `${(t.cost / t.theo / max) * 100}%`,
                      background: TIER_COLOR[t.tier],
                      minWidth: 4,
                    }}
                  />
                  <span className="mono text-right text-xs text-fg-muted">{pp(t.cost / t.theo)}</span>
                </li>
              );
            })}
          </ul>
          <Lead className="mt-4 text-xs text-fg-muted">
            Top region by comp cost: <span className="text-fg">{v.topRegion.region}</span>, {fmt.usdK(v.topRegion.cost)} (
            {pp(v.topRegion.cost / v.topRegion.theo)} of its theo).
          </Lead>
        </Tile>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-8">
        <Tile
          id="monthly"
          className="col-span-12 scroll-mt-20 lg:col-span-7"
          label="By month"
          title={v.monthTitle}
          sub={`Comp cost per month, stacked by tier. Months outside ${label} are dimmed.`}
          table={{
            columns: ["Month", ...TIERS, "Total", "Reinvestment"],
            rows: v.months.map((m) => [m.label, ...TIERS.map((t) => fmt.usd(m.byTier[t] ?? 0)), fmt.usd(m.cost), pp(m.cost / m.theo)]),
          }}
        >
          <Suspense fallback={<Skeleton className="h-[260px] w-full" />}>
            <Chart
              height={260}
              label="Monthly comp cost stacked by tier"
              option={{
                grid: {
                  left: 4,
                  right: 4,
                  top: 24,
                  bottom: 4,
                  containLabel: true,
                },
                legend: {
                  show: true,
                  top: 0,
                  right: 0,
                  itemWidth: 10,
                  itemHeight: 10,
                  textStyle: { color: colors["fg-muted"], fontSize: 11 },
                },
                tooltip: {
                  trigger: "axis",
                  formatter: (q: unknown) => {
                    const a = q as { dataIndex: number }[];
                    const m = v.months[a[0].dataIndex];
                    return tipHtml(m.label, [
                      ...TIERS.map((t) => [t, fmt.usdK(m.byTier[t] ?? 0)] as [string, string]),
                      ["Reinvestment", pp(m.cost / m.theo)],
                    ]);
                  },
                },
                xAxis: { type: "category", data: v.months.map((m) => m.label) },
                yAxis: {
                  type: "value",
                  axisLabel: { formatter: (x: number) => fmt.usdK(x) },
                },
                series: TIERS.map((t) => ({
                  name: t,
                  type: "bar" as const,
                  stack: "c",
                  itemStyle: { color: TIER_COLOR[t] },
                  data: v.months.map((m) => ({
                    value: m.byTier[t] ?? 0,
                    itemStyle: {
                      color: TIER_COLOR[t],
                      opacity: m.inPeriod ? 1 : 0.3,
                    },
                  })),
                })),
              }}
            />
          </Suspense>
        </Tile>

        <Tile
          id="counted-once"
          className="col-span-12 scroll-mt-20 lg:col-span-5"
          label="Counted once"
          title={`Comped F&B carries ${fmt.usdK(data.fnb.comped_cogs)} of COGS, the same dollars as comp cost`}
          sub="Comp redemptions appear twice in the raw data: as ledger cost and as zero-cash F&B rows. We count them once."
          footer={<EvidenceLink to="/players" focus="concentration" filters={{ period: f.period }} label="Who earns the comps" />}
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {(
              [
                ["Paid F&B cash", data.fnb.paid_cash],
                ["Paid F&B COGS", data.fnb.paid_cogs],
                ["Comp cost (ledger)", data.fnb.ledger_cost],
                ["Comped F&B COGS", data.fnb.comped_cogs],
              ] as const
            ).map(([k, x]) => (
              <div key={k}>
                <dt className="eyebrow">{k}</dt>
                <dd className="mono mt-1 text-lg text-fg">{fmt.usdK(x)}</dd>
              </div>
            ))}
          </dl>
          <Evidence className="mt-4">
            <p className="text-xs">{data.notes.double_count}</p>
          </Evidence>
          <Lead className="mt-2 text-xs text-fg-muted">
            Guardrail: comp changes are judged on cost per dollar of theo, never by pushing more offers to players with heavy losses.
          </Lead>
        </Tile>
      </div>
    </div>
  );
}

function derive(data: CompsData, period: string) {
  const weeks = rows<Week>(data.weekly);
  const seg = rows<SegRow>(data.by_segment);
  const months = PERIOD_MONTHS[period] ?? [period];
  const inP = seg.filter((r) => months.includes(r.month));
  const sum = (xs: SegRow[], k: keyof SegRow) => xs.reduce((a, r) => a + (r[k] as number), 0);
  const cost = sum(inP, "comp_cost");
  const theo = sum(inP, "theo");

  const tiers = TIERS.map((t) => {
    const xs = inP.filter((r) => r.tier === t);
    return {
      tier: t,
      cost: sum(xs, "comp_cost"),
      theo: sum(xs, "theo"),
      players: sum(xs, "players"),
    };
  }).filter((t) => t.theo > 0);
  const hiT = [...tiers].sort((a, b) => b.cost / b.theo - a.cost / a.theo)[0];
  const loT = [...tiers].sort((a, b) => a.cost / a.theo - b.cost / b.theo)[0];
  const tierTitle = `${hiT.tier} players get ${pp(hiT.cost / hiT.theo)} of their theo back in comps; ${loT.tier}, ${pp(loT.cost / loT.theo)}`;

  const regions = new Map<string, { cost: number; theo: number }>();
  for (const r of inP) {
    const x = regions.get(r.region) ?? { cost: 0, theo: 0 };
    x.cost += r.comp_cost;
    x.theo += r.theo;
    regions.set(r.region, x);
  }
  const topRegion = [...regions.entries()].map(([region, x]) => ({ region, ...x })).sort((a, b) => b.cost - a.cost)[0];

  const monthRows = MONTHS.map((m, i) => {
    const xs = seg.filter((r) => r.month === m);
    const byTier: Record<string, number> = {};
    for (const t of TIERS)
      byTier[t] = sum(
        xs.filter((r) => r.tier === t),
        "comp_cost",
      );
    return {
      label: MONTH_SHORT[i],
      inPeriod: months.includes(m),
      cost: sum(xs, "comp_cost"),
      theo: sum(xs, "theo"),
      byTier,
    };
  });
  const first = monthRows[0];
  const last = monthRows[monthRows.length - 1];
  const monthTitle = `Comp cost per dollar of theo rose from ${pp(first.cost / first.theo)} in Jan to ${pp(last.cost / last.theo)} in Jun`;

  const k = data.change_points.reinvestment.k;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1);
  return {
    weeks,
    cost,
    theo,
    face: sum(inP, "comp_face"),
    rate: theo ? cost / theo : 0,
    redemptions: sum(inP, "redemptions"),
    redeemers: sum(inP, "redeemers"),
    tiers,
    tierTitle,
    topRegion,
    months: monthRows,
    monthTitle,
    redBefore: mean(weeks.slice(0, k).map((w) => w.redemptions)),
    redAfter: mean(weeks.slice(k).map((w) => w.redemptions)),
  };
}
