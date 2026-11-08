import { lazy, Suspense, useMemo } from "react";
import { EvidenceLink } from "../components/EvidenceLink";
import { PERIOD_LONG } from "../components/shell/nav";
import { HeroBand, Kpi, KpiStrip } from "../components/ui/hero-band";
import { Num } from "../components/ui/num";
import { ErrorState, ScreenSkeleton, Skeleton } from "../components/ui/skeleton";
import { Tile } from "../components/ui/tile";
import { rows, type Columnar } from "../lib/data";
import { fmt } from "../lib/format";
import { isoOf, usePeriodDays } from "../lib/period";
import { useMachineParam } from "../lib/uiStore";
import { useFilters } from "../lib/urlState";
import { sum, useJson, useScorecard } from "../lib/useData";
import { tipHtml } from "../theme/echartsTheme";
import { colors, verdictColors } from "../theme/tokens";

const Chart = lazy(() => import("../components/Chart").then((m) => ({ default: m.Chart })));

export type Ticket = {
  machine_id: string;
  d: number;
  opened: string;
  bank: string;
  zone: string;
  shift: "day" | "swing" | "grave";
  wait_hours: number;
  down_hours: number;
  repair_cost: number;
  lost_theo: number;
};
type BankDay = {
  d: number;
  bank_id: string;
  zone_id: string;
  unavailable_hours: number;
  faults: number;
  lost_lo: number;
  lost_mid: number;
  lost_hi: number;
};
export type DowntimeData = { date0: string; bank_day: Columnar; tickets: Columnar; staffing: Columnar; notes: Record<string, string> };

const SHIFTS = [
  { id: "day", label: "Day", hours: "06–14" },
  { id: "swing", label: "Swing", hours: "14–22" },
  { id: "grave", label: "Grave", hours: "22–06" },
] as const;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export default function Downtime() {
  const [f, set] = useFilters();
  const { rows: sc, error: scErr } = useScorecard(f);
  const { data, error } = useJson<DowntimeData>("downtime.json");
  const win = usePeriodDays(f.period, data?.date0);
  const [, openMachine] = useMachineParam();
  const v = useMemo(() => (data && win ? derive(data, win, f) : null), [data, win, f]);
  if (error || scErr) return <ErrorState what="downtime" error={error ?? scErr ?? ""} />;
  if (!data || !v || !sc.length) return <ScreenSkeleton />;

  const label = PERIOD_LONG[f.period] ?? f.period;
  const scope = f.bank ? `bank ${f.bank}` : f.zone ? f.zone : "the floor";
  const lost = sum(sc, (r) => r.lost_theo_usd);
  const lo = sum(sc, (r) => r.lost_theo_lo_usd);
  const hi = sum(sc, (r) => r.lost_theo_hi_usd);
  const theo = sum(sc, (r) => r.theo_usd);
  const unavail = sum(sc, (r) => r.unavailable_hours);
  const faults = sum(sc, (r) => r.faults);
  const byBank = Object.values(
    sc.reduce<Record<string, { bank: string; zone: string; lost: number; lo: number; hi: number; hours: number; n: number }>>((acc, r) => {
      const b = (acc[r.bank_id] ??= { bank: r.bank_id, zone: r.zone_id, lost: 0, lo: 0, hi: 0, hours: 0, n: 0 });
      b.lost += r.lost_theo_usd;
      b.lo += r.lost_theo_lo_usd;
      b.hi += r.lost_theo_hi_usd;
      b.hours += r.unavailable_hours;
      b.n += 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b.lost - a.lost)
    .slice(0, 12);
  const top = byBank[0];
  const g = v.shift.grave;
  const dayish = mean([v.shift.day.wait, v.shift.swing.wait]);

  return (
    <div>
      <HeroBand
        className="-mx-6"
        eyebrow={`Downtime · ${label}`}
        title={
          <>
            Downtime cost {scope === "the floor" ? "the floor" : scope} {fmt.usdK(lost)} of theo
            {g.n > 0 && dayish > 0 && g.wait / dayish >= 1.3 ? `; grave-shift faults wait ${(g.wait / dayish).toFixed(1)}× longer` : ""}
          </>
        }
        sub={`Range ${fmt.usdK(lo)}–${fmt.usdK(hi)}: ${fmt.int(unavail)} unavailable machine-hours priced at each machine's own same-weekday play. ${fmt.pct(lost / (theo + lost))} of the theo the floor could have earned.`}
      >
        <KpiStrip testId="downtime-kpis">
          <Kpi
            label="Theo lost to downtime"
            value={<Num value={lost} kind="usdCompact" />}
            note={`Range ${fmt.usdK(lo)}–${fmt.usdK(hi)}`}
            focal
            testId="downtime-kpi"
          />
          <Kpi label="Unavailable hours" value={<Num value={unavail} kind="int" />} note={`${fmt.int(faults)} faults opened`} />
          <Kpi label="Median repair" value={`${v.medDown.toFixed(1)} h`} note={`${fmt.int(v.tickets.length)} fault tickets in scope`} />
          <Kpi label="Grave-shift wait" value={`${g.wait.toFixed(1)} h`} note={`Mean time to a tech; day/swing ${dayish.toFixed(1)} h`} />
        </KpiStrip>
      </HeroBand>

      <section id="lost" aria-label="Lost theo by bank" className="mt-16 scroll-mt-20">
        <Tile
          hero
          label="Where it was lost"
          title={top ? `${top.bank} (${top.zone}) lost the most: ${fmt.usdK(top.lost)}` : "No downtime in scope"}
          sub="Theo lost per bank, mid estimate with 25th–75th percentile range. Click a bank to scope every screen to it."
          footer={
            <EvidenceLink
              to="/floor"
              focus="map"
              filters={{ period: f.period, zone: f.zone, bank: f.bank }}
              label="See these banks on the floor"
            />
          }
          table={{
            columns: ["Bank", "Zone", "Lost theo (mid)", "Low", "High", "Unavailable h"],
            rows: byBank.map((b) => [b.bank, b.zone, fmt.usd(b.lost), fmt.usd(b.lo), fmt.usd(b.hi), Math.round(b.hours)]),
          }}
        >
          <ul className="flex flex-col gap-2" aria-label="Lost theo by bank">
            {byBank.map((b) => {
              const max = Math.max(...byBank.map((x) => x.hi), 1);
              const on = f.bank === b.bank;
              return (
                <li key={b.bank}>
                  <button
                    type="button"
                    data-bank={b.bank}
                    aria-pressed={on}
                    onClick={() => set({ bank: on ? null : b.bank, zone: on ? f.zone : b.zone })}
                    className="focus-ring grid w-full grid-cols-[64px_64px_1fr_72px] items-center gap-3 rounded-sm px-1 py-1 text-left hover:bg-surface-2"
                  >
                    <span className={on ? "mono text-sm text-gold-soft" : "mono text-sm text-fg"}>{b.bank}</span>
                    <span className="text-2xs text-fg-subtle">{b.zone}</span>
                    <span className="relative h-3">
                      <span
                        className="absolute inset-y-[4px] rounded-full bg-verdict-downtime/25"
                        style={{ left: `${(b.lo / max) * 100}%`, width: `${((b.hi - b.lo) / max) * 100}%` }}
                      />
                      <span
                        className="absolute inset-y-[3px] left-0 rounded-full bg-verdict-downtime"
                        style={{ width: `${(b.lost / max) * 100}%`, opacity: 0.85 }}
                      />
                    </span>
                    <span className="mono text-right text-xs text-fg-muted">{fmt.usdK(b.lost)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-2xs text-fg-subtle">{data.notes.lost}</p>
        </Tile>
      </section>

      <div className="mt-8 grid grid-cols-12 gap-8">
        <Tile
          id="shifts"
          className="col-span-12 scroll-mt-20 lg:col-span-7"
          label="By shift"
          title={
            g.n ? `Grave tickets wait ${g.wait.toFixed(1)} h for a tech vs. ${dayish.toFixed(1)} h on day and swing` : "Waits by shift"
          }
          sub="Each fault ticket: wait for a tech (dark) then repair (light), mean hours, by the shift it opened in"
          table={{
            columns: ["Shift", "Tickets", "Mean wait h", "Mean down h", "Slot techs planned", "Actual", "Lost theo (est.)"],
            rows: SHIFTS.map((s) => {
              const x = v.shift[s.id];
              return [s.label, x.n, x.wait.toFixed(2), x.down.toFixed(2), x.planned.toFixed(2), x.actual.toFixed(2), fmt.usd(x.lost)];
            }),
          }}
        >
          <div className="flex flex-col gap-4">
            {SHIFTS.map((s) => {
              const x = v.shift[s.id];
              const max = Math.max(...SHIFTS.map((t) => v.shift[t.id].down), 1);
              return (
                <div key={s.id} className="grid grid-cols-[88px_1fr_150px] items-center gap-4">
                  <p className="flex flex-col leading-tight">
                    <span className="text-sm text-fg">{s.label}</span>
                    <span className="mono text-2xs text-fg-subtle">{s.hours}</span>
                  </p>
                  <div className="relative h-5 overflow-hidden rounded-sm bg-surface-2">
                    <div className="absolute inset-y-0 left-0 bg-verdict-downtime/30" style={{ width: `${(x.down / max) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 bg-verdict-downtime" style={{ width: `${(x.wait / max) * 100}%` }} />
                  </div>
                  <p className="mono text-right text-xs text-fg-muted">
                    <span className="text-fg">{x.wait.toFixed(1)}</span> + {(x.down - x.wait).toFixed(1)} h
                    <span className="block text-2xs text-fg-subtle">
                      {x.actual.toFixed(1)} tech{x.actual >= 1.5 ? "s" : ""} on shift
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-fg-muted">
            Grave runs one slot tech; day averages {v.shift.day.actual.toFixed(2)} of {v.shift.day.planned.toFixed(2)} planned. Longer grave
            waits are a staffing pattern, not a machine fault. {data.notes.tickets}
          </p>
        </Tile>

        <Tile
          className="col-span-12 lg:col-span-5"
          label="By month"
          title={v.monthTitle}
          sub={`Lost theo per month in scope (${scope}), mid with range`}
          table={{
            columns: ["Month", "Lost theo (mid)", "Low", "High", "Faults"],
            rows: v.months.map((m) => [m.m, fmt.usd(m.mid), fmt.usd(m.lo), fmt.usd(m.hi), m.faults]),
          }}
        >
          <Suspense fallback={<Skeleton className="h-[240px] w-full" />}>
            <Chart
              height={240}
              label="Bar chart of lost theo by month with range"
              option={{
                grid: { left: 4, right: 8, top: 12, bottom: 4, containLabel: true },
                tooltip: {
                  trigger: "axis",
                  formatter: (q: unknown) => {
                    const a = q as { dataIndex: number }[];
                    const m = v.months[a[0].dataIndex];
                    return tipHtml(m.label, [
                      ["Lost theo", fmt.usdK(m.mid)],
                      ["Range", `${fmt.usdK(m.lo)}–${fmt.usdK(m.hi)}`],
                      ["Faults", String(m.faults)],
                    ]);
                  },
                },
                xAxis: { type: "category", data: v.months.map((m) => m.label) },
                yAxis: { type: "value", axisLabel: { formatter: (x: number) => fmt.usdK(x) } },
                series: [
                  { type: "bar", data: v.months.map((m) => m.mid), itemStyle: { color: verdictColors.downtime } },
                  {
                    type: "custom",
                    renderItem: ((_: unknown, api: { value: (i: number) => number; coord: (p: [number, number]) => [number, number] }) => {
                      const i = api.value(0);
                      const [x, y0] = api.coord([i, api.value(1)]);
                      const [, y1] = api.coord([i, api.value(2)]);
                      return {
                        type: "group",
                        children: [
                          { type: "line", shape: { x1: x, y1: y0, x2: x, y2: y1 }, style: { stroke: colors.fg, lineWidth: 1 } },
                          { type: "line", shape: { x1: x - 5, y1: y0, x2: x + 5, y2: y0 }, style: { stroke: colors.fg, lineWidth: 1 } },
                          { type: "line", shape: { x1: x - 5, y1: y1, x2: x + 5, y2: y1 }, style: { stroke: colors.fg, lineWidth: 1 } },
                        ],
                      };
                    }) as never,
                    data: v.months.map((m, i) => [i, m.lo, m.hi]),
                    z: 3,
                  },
                ],
              }}
            />
          </Suspense>
        </Tile>
      </div>

      <Tile
        id="repeat"
        className="mt-8 scroll-mt-20"
        label="Repeat faults"
        title={v.repeat[0] ? `${v.repeat[0].id} opened ${v.repeat[0].n} fault tickets in ${label}` : "No repeat faults in scope"}
        sub="Machines with the most fault tickets in scope. Open one for its timeline and tickets."
        table={{
          columns: ["Machine", "Bank", "Tickets", "Down h", "Repair cost", "Lost theo (est.)"],
          rows: v.repeat.map((r) => [r.id, r.bank, r.n, r.down.toFixed(1), fmt.usd(r.cost), fmt.usd(r.lost)]),
        }}
      >
        <table className="w-full text-sm" data-testid="repeat-faults">
          <thead className="text-left text-2xs text-fg-subtle">
            <tr>
              <th className="py-1 font-normal">Machine</th>
              <th className="py-1 font-normal">Bank</th>
              <th className="py-1 text-right font-normal">Tickets</th>
              <th className="py-1 text-right font-normal">Down h</th>
              <th className="py-1 text-right font-normal">Repair cost</th>
              <th className="py-1 text-right font-normal">Lost theo (est.)</th>
            </tr>
          </thead>
          <tbody className="mono">
            {v.repeat.map((r) => (
              <tr key={r.id} className="border-t border-divider">
                <td className="py-1.5">
                  <button
                    type="button"
                    className="focus-ring text-gold-soft hover:text-gold"
                    onClick={() =>
                      openMachine(
                        r.id,
                        v.repeat.map((x) => x.id),
                      )
                    }
                  >
                    {r.id}
                  </button>
                </td>
                <td className="py-1.5 text-fg-muted">{r.bank}</td>
                <td className="py-1.5 text-right text-fg">{r.n}</td>
                <td className="py-1.5 text-right">{r.down.toFixed(1)}</td>
                <td className="py-1.5 text-right">{fmt.usd(r.cost)}</td>
                <td className="py-1.5 text-right">{fmt.usd(r.lost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tile>
    </div>
  );
}

function derive(data: DowntimeData, win: [number, number], f: { zone: string | null; bank: string | null }) {
  const inScope = <T extends { d: number }>(r: T, zone: string, bank: string) =>
    r.d >= win[0] && r.d <= win[1] && (!f.zone || zone === f.zone) && (!f.bank || bank === f.bank);
  const tickets = rows<Ticket>(data.tickets).filter((t) => inScope(t, t.zone, t.bank));
  const staff = Object.fromEntries(rows<{ shift: string; planned: number; actual: number }>(data.staffing).map((s) => [s.shift, s]));
  const shift = Object.fromEntries(
    SHIFTS.map((s) => {
      const xs = tickets.filter((t) => t.shift === s.id);
      return [
        s.id,
        {
          n: xs.length,
          wait: mean(xs.map((t) => t.wait_hours)),
          down: mean(xs.map((t) => t.down_hours)),
          lost: xs.reduce((a, t) => a + t.lost_theo, 0),
          planned: staff[s.id]?.planned ?? 0,
          actual: staff[s.id]?.actual ?? 0,
        },
      ];
    }),
  ) as Record<(typeof SHIFTS)[number]["id"], { n: number; wait: number; down: number; lost: number; planned: number; actual: number }>;

  const bd = rows<BankDay>(data.bank_day).filter((r) => inScope(r, r.zone_id, r.bank_id));
  const byMonth: Record<string, { m: string; label: string; mid: number; lo: number; hi: number; faults: number }> = {};
  for (const r of bd) {
    const m = isoOf(data.date0, r.d).slice(0, 7);
    const x = (byMonth[m] ??= {
      m,
      label: new Date(m + "-01T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
      mid: 0,
      lo: 0,
      hi: 0,
      faults: 0,
    });
    x.mid += r.lost_mid;
    x.lo += r.lost_lo;
    x.hi += r.lost_hi;
    x.faults += r.faults;
  }
  const months = Object.values(byMonth).sort((a, b) => a.m.localeCompare(b.m));
  const worst = [...months].sort((a, b) => b.mid - a.mid)[0];
  const monthTitle =
    months.length > 1 && worst
      ? `${worst.label} was the costliest month: ${fmt.usdK(worst.mid)}`
      : worst
        ? `${fmt.usdK(worst.mid)} lost in ${worst.label}`
        : "No downtime";

  const rep: Record<string, { id: string; bank: string; n: number; down: number; cost: number; lost: number }> = {};
  for (const t of tickets) {
    const x = (rep[t.machine_id] ??= { id: t.machine_id, bank: t.bank, n: 0, down: 0, cost: 0, lost: 0 });
    x.n += 1;
    x.down += t.down_hours;
    x.cost += t.repair_cost;
    x.lost += t.lost_theo;
  }
  const repeat = Object.values(rep)
    .sort((a, b) => b.n - a.n || b.down - a.down)
    .slice(0, 10);
  return { tickets, shift, months, monthTitle, repeat, medDown: median(tickets.map((t) => t.down_hours)) };
}
