import { lazy, Suspense, useMemo } from "react";
import { EvidenceLink } from "../components/EvidenceLink";
import { PERIOD_LONG } from "../components/shell/TopBar";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { Num } from "../components/ui/num";
import { ErrorState, ScreenSkeleton, Skeleton } from "../components/ui/skeleton";
import { Tile } from "../components/ui/tile";
import { rows, type Columnar } from "../lib/data";
import { fmt } from "../lib/format";
import { DIM_LABEL, parseSeg, segLabel, useSegment, type SegDim } from "../lib/segment";
import { useFilters } from "../lib/urlState";
import { useJson } from "../lib/useData";
import { areaFill, tipHtml } from "../theme/echartsTheme";
import { colors } from "../theme/tokens";

const Chart = lazy(() => import("../components/Chart").then((m) => ({ default: m.Chart })));

type Seg = {
  period: string;
  segment: string;
  players: number;
  wagered: number;
  returned: number;
  net: number;
  theo: number;
  visits: number;
  hours: number;
  median_net: number;
  winners_share: number;
  top1_theo: number;
  top10_theo: number;
  top1_loss: number;
  top10_loss: number;
  gini_theo: number;
  lorenz_theo: number[];
  net_hist: number[];
};
type Cell = {
  month: string;
  tier: string;
  region: string;
  age: string;
  visits: number;
  hours: number;
  wagered: number;
  returned: number;
  net: number;
  theo: number;
  comp_cost: number;
  players: number;
};
type PlayersData = {
  dims: Record<SegDim, string[]>;
  tier_order: string[];
  segments: Columnar;
  cube: Columnar;
  net_edges: (number | null)[];
  notes: Record<string, string>;
};

const MONTHS = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const PERIOD_MONTHS: Record<string, string[]> = { full: MONTHS, train: MONTHS.slice(0, 4), test: MONTHS.slice(4) };
const DIMS: SegDim[] = ["tier", "region", "age"];

const binLabel = (lo: number | null, hi: number | null) =>
  lo == null ? `< ${fmt.usdK(hi)}` : hi == null ? `≥ ${fmt.usdK(lo)}` : `${fmt.usdK(lo)} to ${fmt.usdK(hi)}`;

export default function Players() {
  const { data, error } = useJson<PlayersData>("players_segments.json");
  const [f] = useFilters();
  const [seg, setSeg] = useSegment();
  const v = useMemo(() => (data ? derive(data, f.period, seg) : null), [data, f.period, seg]);
  if (error) return <ErrorState what="players" error={error} />;
  if (!data || !v) return <ScreenSkeleton />;
  const label = PERIOD_LONG[f.period] ?? f.period;
  const s = v.s;
  const who = segLabel(seg);

  return (
    <div>
      <HeroBand
        className="-mx-6"
        eyebrow={`Players · ${label}${seg === "all" ? "" : ` · ${seg.replace(":", " ")}`}`}
        title={
          <>
            The top 10% of {who} produce {fmt.pct(s.top10_theo, 0)} of their theo; the top 1% alone, {fmt.pct(s.top1_theo, 0)}
          </>
        }
        sub={`${label}: ${fmt.int(s.players)} carded players wagered ${fmt.usdK(s.wagered)} and got back ${fmt.usdK(s.returned)}. ${fmt.pct(s.winners_share, 0)} finished ahead; the median player lost ${fmt.usd(-s.median_net)}.`}
      >
        <KpiStrip testId="players-kpis">
          <Kpi label="Carded players" value={<Num value={s.players} kind="int" />} note={`${fmt.usdK(s.theo)} theo`} />
          <Kpi
            label="Wagered per player"
            value={<Num value={s.wagered / s.players} kind="usd" />}
            note={`${(s.visits / s.players).toFixed(1)} visits each`}
          />
          <Kpi
            label="Returned per player"
            value={<Num value={s.returned / s.players} kind="usd" />}
            note={`${fmt.pct(s.returned / s.wagered)} of wagered`}
          />
          <Kpi
            label="Net per player"
            value={<Num value={s.net / s.players} kind="usd" />}
            note={`Player's view; median ${fmt.usd(s.median_net)}`}
            focal
          />
        </KpiStrip>
      </HeroBand>

      <SegmentBar data={data} seg={seg} setSeg={setSeg} />

      <div className="mt-8 grid grid-cols-12 gap-8">
        <Tile
          id="concentration"
          hero
          className="col-span-12 scroll-mt-20 lg:col-span-7"
          label="Concentration"
          title={`Gini ${s.gini_theo.toFixed(2)}: theo is ${s.gini_theo > 0.6 ? "highly" : "moderately"} concentrated among ${who}`}
          sub="Lorenz curve: players ranked from least to most theo. The further the curve sags below the diagonal, the more a few players carry the floor."
          table={{
            columns: ["Bottom share of players", "Share of theo"],
            rows: s.lorenz_theo.filter((_, i) => i % 5 === 0).map((y, i) => [fmt.pct((i * 5) / (s.lorenz_theo.length - 1), 0), fmt.pct(y)]),
          }}
        >
          <div data-sig={`lorenz:${s.players}:${s.gini_theo.toFixed(4)}`} className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_200px]">
            <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
              <Chart
                height={300}
                label={`Lorenz curve of theo across ${who}, Gini ${s.gini_theo.toFixed(2)}`}
                option={{
                  grid: { left: 4, right: 12, top: 12, bottom: 4, containLabel: true },
                  tooltip: {
                    trigger: "axis",
                    formatter: (q: unknown) => {
                      const a = q as { value: [number, number] }[];
                      const [x, y] = a[0].value;
                      return tipHtml(`Bottom ${fmt.pct(x, 0)} of players`, [
                        ["Share of theo", fmt.pct(y)],
                        ["Top " + fmt.pct(1 - x, 0), fmt.pct(1 - y)],
                      ]);
                    },
                  },
                  xAxis: { type: "value", min: 0, max: 1, axisLabel: { formatter: (x: number) => fmt.pct(x, 0) } },
                  yAxis: { type: "value", min: 0, max: 1, axisLabel: { formatter: (x: number) => fmt.pct(x, 0) } },
                  series: [
                    {
                      type: "line",
                      data: [
                        [0, 0],
                        [1, 1],
                      ],
                      symbol: "none",
                      silent: true,
                      lineStyle: { color: colors["fg-subtle"], type: "dashed", width: 1 },
                    },
                    {
                      type: "line",
                      data: s.lorenz_theo.map((y, i) => [i / (s.lorenz_theo.length - 1), y]),
                      symbol: "none",
                      smooth: false,
                      lineStyle: { color: colors["gold-soft"], width: 2 },
                      areaStyle: { color: areaFill(colors.gold, 0.12), origin: "start" },
                      markPoint: {
                        symbol: "circle",
                        symbolSize: 7,
                        itemStyle: { color: colors.gold },
                        label: { color: colors.fg, fontSize: 10, position: "left" },
                        data: [
                          { name: "top10", coord: [0.9, 1 - s.top10_theo], value: `top 10%: ${fmt.pct(s.top10_theo, 0)}` },
                          { name: "top1", coord: [0.99, 1 - s.top1_theo], value: `top 1%: ${fmt.pct(s.top1_theo, 0)}` },
                        ],
                      },
                    },
                  ],
                }}
              />
            </Suspense>
            <dl className="grid grid-cols-2 content-start gap-x-4 gap-y-5 md:grid-cols-1" data-testid="concentration-shares">
              {(
                [
                  ["Top 1%, theo", s.top1_theo],
                  ["Top 10%, theo", s.top10_theo],
                  ["Top 1%, net loss", s.top1_loss],
                  ["Top 10%, net loss", s.top10_loss],
                ] as const
              ).map(([k, x]) => (
                <div key={k}>
                  <dt className="eyebrow">{k}</dt>
                  <dd className="mono mt-1 text-xl text-ivory">{fmt.pct(x)}</dd>
                </div>
              ))}
              <p className="col-span-2 text-2xs text-fg-subtle md:col-span-1">
                Net-loss shares rank players by what they lost; winners offset losers, so a share can pass 100%.
              </p>
            </dl>
          </div>
        </Tile>

        <Tile
          id="distribution"
          className="col-span-12 scroll-mt-20 lg:col-span-5"
          label="Net per player"
          title={`${fmt.pct(v.histSmall, 0)} of ${who} finished within $100 of even`}
          sub={`Each player's payout minus coin-in over ${label}. Left of zero: the player lost.`}
          table={{
            columns: ["Net per player", "Players", "Share"],
            rows: v.hist.map((h) => [h.label, fmt.int(h.n), fmt.pct(h.n / s.players)]),
          }}
        >
          <div data-sig={`hist:${s.net_hist.join(",")}`}>
            <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
              <Chart
                height={300}
                label={`Histogram of net per player for ${who}`}
                option={{
                  grid: { left: 4, right: 4, top: 12, bottom: 4, containLabel: true },
                  tooltip: {
                    trigger: "axis",
                    formatter: (q: unknown) => {
                      const a = q as { dataIndex: number }[];
                      const h = v.hist[a[0].dataIndex];
                      return tipHtml(h.label, [
                        ["Players", fmt.int(h.n)],
                        ["Share", fmt.pct(h.n / s.players)],
                      ]);
                    },
                  },
                  xAxis: {
                    type: "category",
                    data: v.hist.map((h) => h.short),
                    axisLabel: { interval: 1, fontSize: 10, rotate: 40 },
                  },
                  yAxis: { type: "value", axisLabel: { formatter: (x: number) => fmt.pct(x / s.players, 0) } },
                  series: [
                    {
                      type: "bar",
                      barCategoryGap: "12%",
                      data: v.hist.map((h) => ({
                        value: h.n,
                        itemStyle: { color: h.hi != null && h.hi <= 0 ? colors.gold : "#6B6261" },
                      })),
                    },
                  ],
                }}
              />
            </Suspense>
          </div>
          <p className="mt-2 text-2xs text-fg-subtle">{data.notes.unit}</p>
        </Tile>
      </div>

      <section id="segments" aria-label="Segments" className="mt-8 grid scroll-mt-20 grid-cols-12 gap-8">
        {DIMS.map((dim) => (
          <Tile
            key={dim}
            className="col-span-12 lg:col-span-4"
            label={`By ${DIM_LABEL[dim].toLowerCase()}`}
            title={v.breakTitle[dim]}
            sub={`Share of theo (gold) vs. share of active player-months (grey)${parseSeg(seg) && parseSeg(seg)!.dim !== dim ? `, within ${who}` : ""}. Click to drill in.`}
            table={{
              columns: [DIM_LABEL[dim], "Theo", "Share of theo", "Player-months", "Theo / player-month"],
              rows: v.breaks[dim].map((b) => [b.key, fmt.usd(b.theo), fmt.pct(b.theoShare), fmt.int(b.pm), fmt.usd(b.theo / b.pm)]),
            }}
          >
            <ul
              className="flex flex-col gap-2"
              data-sig={`${dim}:${v.breaks[dim].map((b) => `${b.key}=${b.theo.toFixed(0)}/${b.pm}`).join("|")}:${seg}`}
            >
              {v.breaks[dim].map((b) => {
                const id = `${dim}:${b.key}`;
                const on = seg === id;
                return (
                  <li key={b.key}>
                    <button
                      type="button"
                      data-segment={id}
                      aria-pressed={on}
                      onClick={() => setSeg(on ? null : id)}
                      className="focus-ring grid w-full grid-cols-[88px_1fr_84px] items-center gap-3 rounded-sm px-1 py-1 text-left hover:bg-surface-2"
                    >
                      <span className={on ? "text-sm text-gold-soft" : "text-sm text-fg"}>{b.key}</span>
                      <span className="flex flex-col gap-1">
                        <span className="h-1.5 rounded-full bg-gold" style={{ width: `${Math.max(b.theoShare * 100, 0.5)}%` }} />
                        <span className="h-1.5 rounded-full bg-fg-subtle/60" style={{ width: `${Math.max(b.pmShare * 100, 0.5)}%` }} />
                      </span>
                      <span className="mono text-right text-xs text-fg-muted">
                        {fmt.pct(b.theoShare, 0)} <span className="text-fg-subtle">/ {fmt.pct(b.pmShare, 0)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Tile>
        ))}
      </section>

      <div className="mt-8 grid grid-cols-12 gap-8">
        <Tile
          id="months"
          className="col-span-12 scroll-mt-20 lg:col-span-8"
          label="By month"
          title={v.monthTitle}
          sub={`Active ${who} (bars) and theo per active player (line), by month. Months outside ${label} are dimmed.`}
          table={{
            columns: ["Month", "Active players", "Theo", "Theo / player", "Net / player"],
            rows: v.months.map((m) => [
              m.label,
              fmt.int(m.players),
              fmt.usd(m.theo),
              fmt.usd(m.theo / m.players),
              fmt.usd(m.net / m.players),
            ]),
          }}
        >
          <div data-sig={`months:${v.months.map((m) => `${m.players}/${m.theo.toFixed(0)}`).join("|")}:${f.period}`}>
            <Suspense fallback={<Skeleton className="h-[260px] w-full" />}>
              <Chart
                height={260}
                label={`Monthly active players and theo per player for ${who}`}
                option={{
                  grid: { left: 4, right: 4, top: 24, bottom: 4, containLabel: true },
                  legend: { top: 0, right: 0, textStyle: { color: colors["fg-muted"], fontSize: 11 } },
                  tooltip: {
                    trigger: "axis",
                    formatter: (q: unknown) => {
                      const a = q as { dataIndex: number }[];
                      const m = v.months[a[0].dataIndex];
                      return tipHtml(m.label, [
                        ["Active players", fmt.int(m.players)],
                        ["Theo / player", fmt.usd(m.theo / m.players)],
                        ["Net / player", fmt.usd(m.net / m.players)],
                      ]);
                    },
                  },
                  xAxis: { type: "category", data: v.months.map((m) => m.label) },
                  yAxis: [
                    { type: "value", axisLabel: { formatter: (x: number) => fmt.int(x) } },
                    { type: "value", splitLine: { show: false }, axisLabel: { formatter: (x: number) => fmt.usd(x) } },
                  ],
                  series: [
                    {
                      name: "Active players",
                      type: "bar",
                      data: v.months.map((m) => ({ value: m.players, itemStyle: { color: m.inPeriod ? "#5A5150" : "#2A2525" } })),
                    },
                    {
                      name: "Theo / player",
                      type: "line",
                      yAxisIndex: 1,
                      data: v.months.map((m) => m.theo / m.players),
                      lineStyle: { color: colors["gold-soft"], width: 2 },
                      itemStyle: { color: colors.gold },
                    },
                  ],
                }}
              />
            </Suspense>
          </div>
        </Tile>

        <Tile
          className="col-span-12 lg:col-span-4"
          label="How to read this"
          title="Concentration is a fact about play, not a target list"
          sub="Where the theo comes from, so floor and comp decisions are sized to who actually plays."
          footer={<EvidenceLink to="/comps" focus="change-point" filters={{ period: f.period }} label="What the comp program spends" />}
        >
          <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-fg-muted">
            <li>{data.notes.tier}</li>
            <li>Players are identified only as counts and sums; {data.notes.privacy.toLowerCase()}</li>
            <li>
              No recommendation here aims more play at players with heavy losses; offers are sized to theo and capped by the comp budget.
            </li>
          </ul>
        </Tile>
      </div>
    </div>
  );
}

function SegmentBar({ data, seg, setSeg }: { data: PlayersData; seg: string; setSeg: (s: string | null) => void }) {
  const p = parseSeg(seg);
  return (
    <nav aria-label="Player segment" className="mx-6 mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 md:mx-10" data-testid="segment-bar">
      <button
        type="button"
        data-segment="all"
        aria-pressed={seg === "all"}
        onClick={() => setSeg(null)}
        className={`focus-ring rounded-full border px-3 py-1 text-xs ${seg === "all" ? "border-gold/60 text-gold-soft" : "border-divider text-fg-muted hover:text-fg"}`}
      >
        All players
      </button>
      {DIMS.map((dim) => (
        <div key={dim} className="flex flex-wrap items-center gap-1.5">
          <span className="eyebrow mr-1">{DIM_LABEL[dim]}</span>
          {(dim === "tier" ? data.tier_order : data.dims[dim]).map((val) => {
            const id = `${dim}:${val}`;
            const on = p?.dim === dim && p.value === val;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={on}
                onClick={() => setSeg(on ? null : id)}
                className={`focus-ring rounded-full border px-2.5 py-0.5 text-xs ${on ? "border-gold/60 text-gold-soft" : "border-divider text-fg-muted hover:text-fg"}`}
              >
                {val}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function derive(data: PlayersData, period: string, seg: string) {
  const segs = rows<Seg>(data.segments);
  const s = segs.find((r) => r.period === period && r.segment === seg) ?? segs.find((r) => r.period === period && r.segment === "all")!;
  const months = PERIOD_MONTHS[period] ?? [period];
  const p = parseSeg(seg);
  const cube = rows<Cell>(data.cube);
  const inSeg = (c: Cell) => !p || c[p.dim] === p.value;

  const hist = s.net_hist.map((n, i) => {
    const lo = data.net_edges[i];
    const hi = data.net_edges[i + 1];
    return { n, lo, hi, label: binLabel(lo, hi), short: lo == null ? `<${fmt.usdK(hi)}` : hi == null ? `${fmt.usdK(lo)}+` : fmt.usdK(lo) };
  });
  const histSmall =
    hist.filter((h) => h.lo != null && h.hi != null && h.lo >= -100 && h.hi <= 100).reduce((a, h) => a + h.n, 0) / s.players;

  // Breakdowns: other dimensions are filtered to the segment; the segment's own dimension shows all values.
  const breaks = {} as Record<SegDim, { key: string; theo: number; pm: number; theoShare: number; pmShare: number }[]>;
  const breakTitle = {} as Record<SegDim, string>;
  for (const dim of DIMS) {
    const pool = cube.filter((c) => months.includes(c.month) && (p?.dim === dim ? true : inSeg(c)));
    const order = dim === "tier" ? data.tier_order : data.dims[dim];
    const by = new Map<string, { theo: number; pm: number }>();
    for (const c of pool) {
      const b = by.get(c[dim]) ?? { theo: 0, pm: 0 };
      b.theo += c.theo;
      b.pm += c.players;
      by.set(c[dim], b);
    }
    const tt = [...by.values()].reduce((a, b) => a + b.theo, 0) || 1;
    const tp = [...by.values()].reduce((a, b) => a + b.pm, 0) || 1;
    breaks[dim] = order
      .filter((k) => by.has(k))
      .map((k) => ({ key: k, ...by.get(k)!, theoShare: by.get(k)!.theo / tt, pmShare: by.get(k)!.pm / tp }));
    const top = [...breaks[dim]].sort((a, b) => b.theoShare / b.pmShare - a.theoShare / a.pmShare)[0];
    breakTitle[dim] = top
      ? `${top.key}: ${fmt.pct(top.pmShare, 0)} of player-months, ${fmt.pct(top.theoShare, 0)} of theo`
      : `No ${DIM_LABEL[dim].toLowerCase()} data`;
  }

  const monthRows = MONTHS.map((m, i) => {
    const cs = cube.filter((c) => c.month === m && inSeg(c));
    return {
      month: m,
      label: MONTH_SHORT[i],
      inPeriod: months.includes(m),
      players: cs.reduce((a, c) => a + c.players, 0),
      theo: cs.reduce((a, c) => a + c.theo, 0),
      net: cs.reduce((a, c) => a + c.net, 0),
    };
  });
  const per = monthRows.map((m) => m.theo / m.players);
  const hiM = monthRows[per.indexOf(Math.max(...per))];
  const loM = monthRows[per.indexOf(Math.min(...per))];
  const monthTitle = `Theo per active player ranged ${fmt.usd(loM.theo / loM.players)} (${loM.label}) to ${fmt.usd(hiM.theo / hiM.players)} (${hiM.label})`;

  return { s, hist, histSmall, breaks, breakTitle, months: monthRows, monthTitle };
}
