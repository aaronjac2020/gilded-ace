import { lazy, Suspense, useMemo } from "react";
import { EvidenceLink } from "../components/EvidenceLink";
import { PERIOD_LONG } from "../components/shell/nav";
import { SectionHeader } from "../components/shell/Chapter";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { Num } from "../components/ui/num";
import { ErrorState, ScreenSkeleton, Skeleton } from "../components/ui/skeleton";
import { Tile } from "../components/ui/tile";
import { rows, type Columnar } from "../lib/data";
import { fmt } from "../lib/format";
import { isoOf, usePeriodDays, WEEKDAY_LONG, WEEKDAYS } from "../lib/period";
import { useFilters } from "../lib/urlState";
import { useJson } from "../lib/useData";
import { areaFill, tipHtml } from "../theme/echartsTheme";
import { colors, scales } from "../theme/tokens";
import { Lead } from "../components/ui/more";

const Chart = lazy(() => import("../components/Chart").then((m) => ({ default: m.Chart })));

type Day = {
  d: number;
  weekday: string;
  coin_in: number;
  theo: number;
  house_win: number;
  occupied_hours: number;
  traffic: number;
  entrance: number;
  masked_hours: number;
  fnb_cash: number;
  fnb_cogs: number;
  comp_face: number;
  tmax_c: number | null;
  prcp_mm: number | null;
  holiday: string | null;
  events: string;
};
type ZoneDay = {
  d: number;
  zone: string;
  entries: number;
  masked_hours: number;
};
type Ev = {
  event_id: string;
  name: string;
  event_type: string;
  scope: string;
  start: string;
  end: string;
  days: number;
  baseline_days: number;
  uplift: number;
  uplift_lo: number;
  uplift_hi: number;
};
type City = {
  month: string;
  visitor_volume: number;
  visitor_yoy_ratio: number;
  convention_attendance: number;
  hotel_occupancy_ratio: number;
};
type Closure = {
  walkway_id: string;
  zones: string[];
  reason: string;
  d_from: number;
  d_to: number;
  share: Record<string, { during: number; outside: number }>;
};
type DemandData = {
  date0: string;
  daily: Columnar;
  zone_daily: Columnar;
  events: Columnar;
  closures: Closure[];
  city: Columnar;
  zones: Columnar;
  notes: Record<string, string>;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const shortDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export default function Demand() {
  const { data, error } = useJson<DemandData>("demand.json");
  const [f, set] = useFilters();
  const win = usePeriodDays(f.period, data?.date0);
  const v = useMemo(() => (data && win ? derive(data, win) : null), [data, win]);
  if (error) return <ErrorState what="demand" error={error} />;
  if (!data || !v || !win) return <ScreenSkeleton />;
  const label = PERIOD_LONG[f.period] ?? f.period;

  return (
    <div>
      <HeroBand
        className="-mx-6"
        eyebrow={`Demand · ${label}`}
        title={
          <>
            {WEEKDAY_LONG[v.top.wd]}s bring in {v.top.x.toFixed(2)}× a {WEEKDAY_LONG[v.low.wd]}'s coin-in in {label}
          </>
        }
        sub={
          v.evDays
            ? `In ${label}, floor coin-in averaged ${fmt.usdK(v.avg)} a day. On the ${v.evDays} event days it ran ${signed(v.evLift)} vs. the same weekdays without one.`
            : `In ${label}, floor coin-in averaged ${fmt.usdK(v.avg)} a day. No listed event fell in this window.`
        }
      >
        <KpiStrip testId="demand-kpis">
          <Kpi label="Coin-in per day" value={<Num value={v.avg} kind="usdCompact" />} note={`${v.days.length} gaming days`} focal />
          <Kpi label="Busiest weekday" value={v.top.wd} note={`${fmt.usdK(v.top.v)} a day vs. ${fmt.usdK(v.low.v)} on ${v.low.wd}`} />
          <Kpi
            label="Door entries per day"
            value={<Num value={v.traffic} kind="int" />}
            note={`Estimated; ${fmt.int(v.masked)} hours with a broken door counter left out`}
          />
          <Kpi
            label="F&B cash per day"
            value={<Num value={v.fnb} kind="usdCompact" />}
            note={`Comps ${fmt.usdK(v.comp)} face value a day`}
          />
        </KpiStrip>
      </HeroBand>

      <SectionHeader
        id="when"
        title="When guests play"
        answers="Q2"
        sentence="Days, weekdays, events and zones, for the selected period."
        className="mt-20"
      />
      <section id="calendar" aria-label="Calendar" className="mt-16 scroll-mt-20">
        <Tile
          hero
          label="Calendar"
          title="Every gaming day, shaded by floor coin-in"
          sub={`Darker = more play. Weekends run darkest; dots mark event days. Days outside ${label} are dimmed.`}
          table={{
            columns: ["Date", "Weekday", "Coin-in", "Events"],
            rows: v.all.map((r) => [isoOf(data.date0, r.d), r.weekday, fmt.usd(r.coin_in), r.events]),
          }}
        >
          <Suspense fallback={<Skeleton className="h-[220px] w-full" />}>
            <CalendarGrid days={v.all} date0={data.date0} win={win} evName={v.evName} />
          </Suspense>
        </Tile>
      </section>

      <div className="mt-8 grid grid-cols-12 gap-8">
        <Tile
          className="col-span-12 lg:col-span-8"
          label="Trend"
          title="Daily coin-in with events and the walkway closure"
          sub="Gold bands: property promotions. Grey bands: citywide events. Hatched: walkway W-ENT-B40 closed."
          table={{
            columns: ["Date", "Coin-in", "Theo", "House win"],
            rows: v.days.map((r) => [isoOf(data.date0, r.d), fmt.usd(r.coin_in), fmt.usd(r.theo), fmt.usd(r.house_win)]),
          }}
        >
          <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
            <Chart
              height={280}
              label="Line chart of daily coin-in with event bands"
              option={{
                grid: {
                  left: 4,
                  right: 12,
                  top: 28,
                  bottom: 4,
                  containLabel: true,
                },
                tooltip: {
                  trigger: "axis",
                  formatter: (q: unknown) => {
                    const a = q as {
                      axisValueLabel: string;
                      value: [string, number];
                    }[];
                    const iso = a[0]?.value[0];
                    const r = v.days.find((x) => isoOf(data.date0, x.d) === iso);
                    return tipHtml(a[0]?.axisValueLabel ?? "", [
                      ["Coin-in", fmt.usdK(a[0]?.value[1])],
                      ...(r?.events
                        ? ([
                            [
                              "Event",
                              r.events
                                .split(",")
                                .map((e) => v.evName[e] ?? e)
                                .join(", "),
                            ],
                          ] as [string, string][])
                        : []),
                    ]);
                  },
                },
                xAxis: { type: "time", axisLabel: { formatter: "{MMM} {d}" } },
                yAxis: {
                  type: "value",
                  axisLabel: { formatter: (x: number) => fmt.usdK(x) },
                  scale: true,
                },
                series: [
                  {
                    name: "Coin-in",
                    type: "line",
                    data: v.days.map((r) => [isoOf(data.date0, r.d), r.coin_in]),
                    lineStyle: { color: colors["gold-soft"], width: 1.5 },
                    itemStyle: { color: colors.gold },
                    areaStyle: { color: areaFill(colors.gold, 0.14) },
                    markArea: {
                      silent: true,
                      data: [
                        ...v.events
                          .filter((e) => e.end >= isoOf(data.date0, win[0]) && e.start <= isoOf(data.date0, win[1]))
                          .map((e) => [
                            {
                              xAxis: e.start,
                              name: e.scope === "property" ? e.name.replace("Gilded Ace ", "") : "",
                              itemStyle: {
                                color: e.scope === "property" ? "rgba(201,130,46,0.16)" : "rgba(255,255,255,0.05)",
                              },
                              label: {
                                color: colors["gold-soft"],
                                fontSize: 10,
                                position: "top",
                              },
                            },
                            {
                              xAxis: isoOf(data.date0, Math.round((Date.parse(e.end) - Date.parse(data.date0)) / 86400000) + 1),
                            },
                          ]),
                        ...data.closures
                          .filter((c) => c.d_to >= win[0] && c.d_from <= win[1])
                          .map((c) => [
                            {
                              xAxis: isoOf(data.date0, Math.max(c.d_from, win[0])),
                              itemStyle: {
                                color: "rgba(180,101,111,0.07)",
                                borderColor: "rgba(180,101,111,0.35)",
                                borderType: "dashed",
                                borderWidth: 1,
                              },
                            },
                            {
                              xAxis: isoOf(data.date0, Math.min(c.d_to, win[1])),
                            },
                          ]),
                      ] as never,
                    },
                  },
                ],
              }}
            />
          </Suspense>
        </Tile>

        <Tile
          className="col-span-12 lg:col-span-4"
          label="Weekday profile"
          title={`${v.top.wd} peaks; ${v.low.wd} is the trough`}
          sub="Mean coin-in per gaming day (06:00 start)"
          table={{
            columns: ["Weekday", "Coin-in / day", "Days"],
            rows: v.weekday.map((w) => [w.wd, fmt.usd(w.v), w.n]),
          }}
        >
          <Suspense fallback={<Skeleton className="h-[280px] w-full" />}>
            <Chart
              height={280}
              label="Bar chart of mean coin-in by weekday"
              option={{
                grid: {
                  left: 4,
                  right: 4,
                  top: 12,
                  bottom: 4,
                  containLabel: true,
                },
                tooltip: {
                  trigger: "axis",
                  formatter: (q: unknown) => {
                    const a = q as { name: string; value: number }[];
                    return tipHtml(a[0].name, [["Coin-in / day", fmt.usdK(a[0].value)]]);
                  },
                },
                xAxis: {
                  type: "category",
                  data: v.weekday.map((w) => w.wd),
                  axisLabel: { interval: 0 },
                },
                yAxis: {
                  type: "value",
                  axisLabel: { formatter: (x: number) => fmt.usdK(x) },
                },
                series: [
                  {
                    type: "bar",
                    data: v.weekday.map((w) => ({
                      value: w.v,
                      itemStyle: {
                        color: w.wd === v.top.wd ? colors.gold : w.wd === v.low.wd ? colors["fg-subtle"] : "#3A3434",
                      },
                    })),
                  },
                ],
              }}
            />
          </Suspense>
        </Tile>
      </div>

      <div className="mt-8 grid grid-cols-12 gap-8">
        <Tile
          id="traffic"
          className="col-span-12 scroll-mt-20 lg:col-span-7"
          label="Zone traffic"
          title={v.zoneTitle}
          sub="Share of estimated door-counter entries, January vs. June. Click a zone to scope the floor."
          footer={<EvidenceLink to="/floor" focus="map" filters={{ period: f.period, zone: f.zone }} label="See it on the floor map" />}
          table={{
            columns: ["Zone", "Jan share", "Jun share", "Change (pts)"],
            rows: v.zoneShare.map((z) => [z.name, fmt.pct(z.jan), fmt.pct(z.jun), ((z.jun - z.jan) * 100).toFixed(1)]),
          }}
        >
          <ul className="flex flex-col gap-2.5" aria-label="Zone traffic share">
            {v.zoneShare.map((z) => {
              const max = Math.max(...v.zoneShare.map((x) => Math.max(x.jan, x.jun)));
              const on = f.zone === z.zone;
              return (
                <li key={z.zone}>
                  <button
                    type="button"
                    onClick={() => set({ zone: on ? null : z.zone, bank: null })}
                    aria-pressed={on}
                    className="focus-ring grid w-full grid-cols-[132px_1fr_124px] items-center gap-3 rounded-sm px-1 py-0.5 text-left hover:bg-surface-2"
                  >
                    <span className={on ? "text-sm text-gold-soft" : "text-sm text-fg"}>{z.name}</span>
                    <span className="flex flex-col gap-1">
                      <span className="h-1.5 rounded-full bg-fg-subtle/60" style={{ width: `${(z.jan / max) * 100}%` }} />
                      <span className="h-1.5 rounded-full bg-gold" style={{ width: `${(z.jun / max) * 100}%` }} />
                    </span>
                    <span className="mono text-right text-xs text-fg-muted">
                      {fmt.pct(z.jun)}{" "}
                      <span className={z.jun >= z.jan ? "text-gold-soft" : "text-fg-subtle"}>{signedPts(z.jun - z.jan)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Lead className="mt-4 flex items-center gap-4 text-2xs text-fg-subtle">
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-1.5 w-4 rounded-full bg-fg-subtle/60" /> January
            </span>
            <span className="flex items-center gap-1.5">
              <i className="inline-block h-1.5 w-4 rounded-full bg-gold" /> June
            </span>
          </Lead>
          {v.closure && (
            <p className="mt-3 text-xs text-fg-muted" data-testid="closure-effect">
              While walkway {v.closure.walkway_id} was closed ({shortDate(isoOf(data.date0, v.closure.d_from))}–
              {shortDate(isoOf(data.date0, v.closure.d_to))}), Back Forty's share of entries fell from{" "}
              {fmt.pct(v.closure.share["Z-B40"].outside)} to {fmt.pct(v.closure.share["Z-B40"].during)}; it recovered after reopening.
            </p>
          )}
          <Lead className="mt-2 text-2xs text-fg-subtle">{data.notes.traffic}</Lead>
        </Tile>

        <Tile
          id="events"
          className="col-span-12 scroll-mt-20 lg:col-span-5"
          label="Event uplift"
          title={v.bestEv ? `${v.bestEv.name.replace("Gilded Ace ", "")} lifted coin-in most: ${signed(v.bestEv.uplift)}` : "Event uplift"}
          sub="Event days vs. same weekdays within 28 days; bars are 90% intervals"
          table={{
            columns: ["Event", "Dates", "Uplift", "90% CI"],
            rows: v.events.map((e) => [
              e.name,
              `${e.start} – ${e.end}`,
              fmt.pct(e.uplift),
              `${fmt.pct(e.uplift_lo)} – ${fmt.pct(e.uplift_hi)}`,
            ]),
          }}
        >
          <ul className="flex flex-col gap-2" aria-label="Event uplift with intervals">
            {v.events.map((e) => {
              const lo = -0.1;
              const hi = 0.35;
              const x = (u: number) => `${((Math.min(hi, Math.max(lo, u)) - lo) / (hi - lo)) * 100}%`;
              return (
                <li key={e.event_id} className="grid grid-cols-[1fr_120px_52px] items-center gap-3 text-xs">
                  <span className="text-fg" title={e.name}>
                    {e.name.replace("Gilded Ace ", "")}
                    <span className="ml-1.5 text-2xs text-fg-subtle">{e.scope === "property" ? "property" : "city"}</span>
                  </span>
                  <span className="relative h-3">
                    <span className="absolute inset-y-[5px] w-px bg-fg-subtle/60" style={{ left: x(0) }} />
                    <span
                      className="absolute inset-y-[5px] h-0.5 rounded-full bg-gold/40"
                      style={{
                        left: x(e.uplift_lo),
                        right: `calc(100% - ${x(e.uplift_hi)})`,
                      }}
                    />
                    <span
                      className={
                        e.uplift_lo > 0
                          ? "absolute top-[2px] h-2 w-2 -translate-x-1/2 rounded-full bg-gold"
                          : "absolute top-[2px] h-2 w-2 -translate-x-1/2 rounded-full border border-fg-muted bg-bg"
                      }
                      style={{ left: x(e.uplift) }}
                    />
                  </span>
                  <span className="mono text-right text-fg-muted">{signed(e.uplift)}</span>
                </li>
              );
            })}
          </ul>
          <Lead className="mt-3 text-2xs text-fg-subtle">Filled dot: interval clears zero. {data.notes.uplift}</Lead>
        </Tile>
      </div>

      <Tile
        className="mt-8"
        label="City context"
        title={v.cityTitle}
        sub="LVCVA visitor volume and NOAA weather are context, labelled as such; no model uses them."
        table={{
          columns: ["Month", "City visitors", "YoY", "Hotel occupancy", "Floor coin-in / day"],
          rows: v.city.map((c) => [
            c.month,
            fmt.int(c.visitor_volume),
            fmt.pct(c.visitor_yoy_ratio),
            fmt.pct(c.hotel_occupancy_ratio),
            fmt.usd(c.floor),
          ]),
        }}
      >
        <div className="grid grid-cols-3 gap-6 md:grid-cols-6">
          {v.city.map((c) => (
            <div key={c.month} className="flex flex-col gap-1">
              <Lead className="label-sc text-fg-muted">{c.label}</Lead>
              <Lead className="mono text-sm text-fg">
                {fmt.usdK(c.floor)}
                <span className="text-2xs text-fg-subtle"> /day</span>
              </Lead>
              <Lead className="text-2xs text-fg-subtle">
                City {(c.visitor_volume / 1e6).toFixed(2)}M ({signed(c.visitor_yoy_ratio, 0)} YoY)
              </Lead>
              <Lead className="text-2xs text-fg-subtle">Avg high {c.tmax != null ? `${c.tmax.toFixed(0)}°C` : "–"}</Lead>
            </div>
          ))}
        </div>
      </Tile>
    </div>
  );
}

const signed = (x: number, d = 1) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(d)}%`;
const signedPts = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1)} pts`;

function derive(data: DemandData, win: [number, number]) {
  const all = rows<Day>(data.daily);
  const days = all.filter((r) => r.d >= win[0] && r.d <= win[1]);
  const events = rows<Ev>(data.events);
  const evName = Object.fromEntries(events.map((e) => [e.event_id, e.name]));
  const weekday = WEEKDAYS.map((wd) => {
    const xs = days.filter((r) => r.weekday === wd);
    return { wd, v: mean(xs.map((r) => r.coin_in)), n: xs.length };
  }).filter((w) => w.n > 0);
  const sorted = [...weekday].sort((a, b) => b.v - a.v);
  const top = { ...sorted[0], x: sorted[0].v / sorted[sorted.length - 1].v };
  const low = sorted[sorted.length - 1];
  // Event lift vs same weekdays without an event, inside the window (ratio of weekday-matched means).
  const wdMean = Object.fromEntries(
    WEEKDAYS.map((wd) => [wd, mean(days.filter((r) => r.weekday === wd && !r.events).map((r) => r.coin_in))]),
  );
  const ev = days.filter((r) => r.events);
  const evLift = ev.length ? mean(ev.map((r) => r.coin_in)) / mean(ev.map((r) => wdMean[r.weekday] || r.coin_in)) - 1 : 0;

  const zoneNames = Object.fromEntries(rows<{ zone_id: string; name: string }>(data.zones).map((z) => [z.zone_id, z.name]));
  const zd = rows<ZoneDay>(data.zone_daily);
  const month = (d: number) => isoOf(data.date0, d).slice(5, 7);
  const share = (m: string) => {
    const xs = zd.filter((r) => month(r.d) === m);
    const tot = xs.reduce((a, r) => a + r.entries, 0);
    const by: Record<string, number> = {};
    for (const r of xs) by[r.zone] = (by[r.zone] ?? 0) + r.entries / tot;
    return by;
  };
  const jan = share("01");
  const jun = share("06");
  const zoneShare = Object.keys(jan)
    .map((zone) => ({
      zone,
      name: zoneNames[zone] ?? zone,
      jan: jan[zone],
      jun: jun[zone] ?? 0,
    }))
    .sort((a, b) => b.jun - a.jun);
  const mover = [...zoneShare].sort((a, b) => Math.abs(b.jun - b.jan) - Math.abs(a.jun - a.jan))[0];
  const zoneTitle =
    Math.abs(mover.jun - mover.jan) < 0.01
      ? `Zone traffic mix held steady Jan → Jun; ${zoneShare[0].name} draws ${fmt.pct(zoneShare[0].jun, 0)} of entries`
      : `${mover.name} ${mover.jun > mover.jan ? "gained" : "lost"} ${Math.abs((mover.jun - mover.jan) * 100).toFixed(1)} pts of traffic share, Jan → Jun`;

  const evIn = events.filter((e) => days.some((r) => r.events.split(",").includes(e.event_id)));
  const evShow = evIn.length ? evIn : events;
  const bestEv = [...evShow].sort((a, b) => b.uplift - a.uplift)[0] ?? null;

  const city = rows<City>(data.city).map((c) => {
    const xs = all.filter((r) => isoOf(data.date0, r.d).slice(0, 7) === c.month);
    const w = xs.map((r) => r.tmax_c).filter((t): t is number => t != null);
    return {
      ...c,
      label: new Date(c.month + "-01T00:00:00Z").toLocaleDateString("en-US", {
        month: "short",
        timeZone: "UTC",
      }),
      floor: mean(xs.map((r) => r.coin_in)),
      tmax: w.length ? mean(w) : null,
    };
  });
  const juneDrop = city.length > 1 ? city[city.length - 1].visitor_volume / city[city.length - 2].visitor_volume - 1 : 0;
  const cityTitle = `City visitors ${juneDrop < 0 ? "fell" : "rose"} ${Math.abs(juneDrop * 100).toFixed(0)}% into June; floor coin-in per day moved ${signed(city[city.length - 1].floor / city[city.length - 2].floor - 1)}`;

  const closure = data.closures.find((c) => c.share["Z-B40"]) ?? null;
  return {
    all,
    days,
    events: evShow,
    evName,
    weekday,
    top,
    low,
    avg: mean(days.map((r) => r.coin_in)),
    traffic: mean(days.map((r) => r.traffic)),
    masked: days.reduce((a, r) => a + r.masked_hours, 0),
    fnb: mean(days.map((r) => r.fnb_cash)),
    comp: mean(days.map((r) => r.comp_face)),
    evDays: ev.length,
    evLift,
    zoneShare,
    zoneTitle,
    bestEv,
    city,
    cityTitle,
    closure,
  };
}

/** Calendar as a week x weekday heatmap (sequential, light -> maroon). Event days carry a dot. */
function CalendarGrid({ days, date0, win, evName }: { days: Day[]; date0: string; win: [number, number]; evName: Record<string, string> }) {
  const off = (new Date(date0 + "T00:00:00Z").getUTCDay() + 6) % 7; // Monday = 0
  const cell = (d: number) => [Math.floor((d + off) / 7), 6 - ((d + off) % 7)];
  const inWin = days.filter((r) => r.d >= win[0] && r.d <= win[1]);
  const vals = inWin.map((r) => r.coin_in);
  const weeks = Math.floor((days[days.length - 1].d + off) / 7) + 1;
  const monthStarts = days
    .filter((r) => isoOf(date0, r.d).endsWith("-01"))
    .map((r) => ({ w: Math.floor((r.d + off) / 7), iso: isoOf(date0, r.d) }));
  return (
    <Chart
      height={252}
      label="Calendar heatmap of daily coin-in by week and weekday"
      option={{
        grid: { left: 36, right: 8, top: 22, bottom: 40 },
        tooltip: {
          formatter: (p: unknown) => {
            const q = p as { data: { r: Day } };
            const r = q.data.r;
            const ev = r.events
              ? r.events
                  .split(",")
                  .map((e) => evName[e] ?? e)
                  .join(", ")
              : "";
            return tipHtml(`${r.weekday} ${shortDate(isoOf(date0, r.d))}`, [
              ["Coin-in", fmt.usdK(r.coin_in)],
              ["Door entries", fmt.int(r.traffic)],
              ...(ev ? ([["Event", ev]] as [string, string][]) : []),
              ...(r.holiday ? ([["Holiday", r.holiday]] as [string, string][]) : []),
            ]);
          },
        },
        xAxis: {
          type: "category",
          data: Array.from({ length: weeks }, (_, i) => String(i)),
          axisLabel: {
            interval: 0,
            formatter: (w: string) => {
              const m = monthStarts.find((s) => s.w === Number(w));
              return m
                ? new Date(m.iso + "T00:00:00Z").toLocaleDateString("en-US", {
                    month: "short",
                    timeZone: "UTC",
                  })
                : "";
            },
          },
          position: "top",
        },
        yAxis: { type: "category", data: [...WEEKDAYS].reverse() },
        visualMap: {
          show: true,
          orient: "horizontal",
          left: 36,
          bottom: 0,
          itemWidth: 10,
          itemHeight: 140,
          calculable: false,
          text: ["More play", "Less"],
          textStyle: { color: colors["fg-muted"], fontSize: 12 },
          min: Math.min(...vals),
          max: Math.max(...vals),
          inRange: { color: [...scales.sequential].slice(1) },
          seriesIndex: 0,
        },
        series: [
          {
            type: "heatmap",
            data: inWin.map((r) => ({ value: [...cell(r.d), r.coin_in], r })),
            itemStyle: {
              borderColor: colors.bg,
              borderWidth: 2,
              borderRadius: 3,
            },
            emphasis: {
              itemStyle: { borderColor: colors["gold-soft"], borderWidth: 1 },
            },
          },
          {
            type: "heatmap",
            data: days.filter((r) => r.d < win[0] || r.d > win[1]).map((r) => ({ value: [...cell(r.d), 0], r })),
            itemStyle: {
              color: colors["surface-2"],
              borderColor: colors.bg,
              borderWidth: 2,
              borderRadius: 3,
            },
          },
          {
            type: "scatter",
            data: inWin.filter((r) => r.events).map((r) => ({ value: cell(r.d), r })),
            symbolSize: 4,
            itemStyle: { color: colors.fg },
            silent: true,
            z: 3,
          },
        ],
      }}
    />
  );
}
