import { lazy, Suspense, useMemo } from "react";
import type { Columnar } from "../lib/data";
import { rows } from "../lib/data";
import { fmt } from "../lib/format";
import { isoOf } from "../lib/period";
import { useJson } from "../lib/useData";
import type { DowntimeData, Ticket } from "../screens/Downtime";
import { tipHtml } from "../theme/echartsTheme";
import { colors, verdictColors } from "../theme/tokens";
import { Skeleton } from "./ui/skeleton";

const Chart = lazy(() => import("./Chart").then((m) => ({ default: m.Chart })));

type Slim = Columnar & { date0: string };

/** Drawer tab: daily theo (bars) and unavailable hours (line) for one machine; loads machine_day_slim on first open. */
export function MachineTimeline({ id }: { id: string }) {
  const { data, error } = useJson<Slim>("machine_day_slim.json");
  const days = useMemo(() => {
    if (!data) return [];
    const k = data.dicts?.machine_id.indexOf(id) ?? -1;
    const ix: number[] = [];
    data.data.machine_id.forEach((v, i) => v === k && ix.push(i));
    const col = (c: string) => ix.map((i) => data.data[c][i] as number);
    const d = col("d");
    const theo = col("theo");
    const av = col("available_hours");
    const sch = col("scheduled_hours");
    return d.map((x, j) => ({ iso: isoOf(data.date0, x), theo: theo[j], down: Math.max(0, sch[j] - av[j]) }));
  }, [data, id]);
  if (error) return <p className="text-xs text-fg-muted">Timeline unavailable: {error}</p>;
  if (!data) return <Skeleton className="h-[220px] w-full" />;
  const theo = days.reduce((a, r) => a + r.theo, 0);
  const down = days.reduce((a, r) => a + r.down, 0);
  return (
    <div data-testid="drawer-timeline">
      <p className="text-sm text-fg">
        {days.length} days on floor · theo {fmt.usdK(theo)} · {fmt.int(down)} unavailable hours
      </p>
      <Suspense fallback={<Skeleton className="mt-3 h-[220px] w-full" />}>
        <Chart
          height={220}
          label={`Daily theo and unavailable hours for ${id}`}
          option={{
            grid: { left: 4, right: 4, top: 16, bottom: 4, containLabel: true },
            tooltip: {
              trigger: "axis",
              formatter: (q: unknown) => {
                const a = q as { axisValueLabel: string; seriesName: string; value: [string, number]; color: string }[];
                return tipHtml(
                  a[0]?.axisValueLabel ?? "",
                  a.map((s) => [s.seriesName, s.seriesName === "Theo" ? fmt.usd(s.value[1]) : `${s.value[1].toFixed(1)} h`, s.color]),
                );
              },
            },
            xAxis: { type: "time", axisLabel: { formatter: "{MMM}" } },
            yAxis: [
              { type: "value", axisLabel: { formatter: (x: number) => fmt.usdK(x) } },
              { type: "value", max: 24, splitLine: { show: false }, axisLabel: { formatter: "{value} h" } },
            ],
            series: [
              {
                name: "Theo",
                type: "bar",
                data: days.map((r) => [r.iso, r.theo]),
                itemStyle: { color: colors.gold, borderRadius: 0 },
                barMaxWidth: 3,
              },
              {
                name: "Unavailable",
                type: "line",
                yAxisIndex: 1,
                step: "middle",
                data: days.map((r) => [r.iso, r.down]),
                lineStyle: { color: verdictColors.downtime, width: 1 },
                itemStyle: { color: verdictColors.downtime },
              },
            ],
          }}
        />
      </Suspense>
    </div>
  );
}

/** Drawer tab: this machine's fault tickets, newest first. */
export function MachineTickets({ id }: { id: string }) {
  const { data, error } = useJson<DowntimeData>("downtime.json");
  const list = useMemo(
    () =>
      data
        ? rows<Ticket>(data.tickets)
            .filter((t) => t.machine_id === id)
            .sort((a, b) => b.opened.localeCompare(a.opened))
        : [],
    [data, id],
  );
  if (error) return <p className="text-xs text-fg-muted">Tickets unavailable: {error}</p>;
  if (!data) return <Skeleton className="h-[160px] w-full" />;
  if (!list.length) return <p className="text-sm text-fg-muted">No fault tickets for {id} in Jan–Jun.</p>;
  const down = list.reduce((a, t) => a + t.down_hours, 0);
  return (
    <div data-testid="drawer-tickets">
      <p className="text-sm text-fg">
        {list.length} fault tickets · {down.toFixed(1)} h down · repairs {fmt.usd(list.reduce((a, t) => a + t.repair_cost, 0))}
      </p>
      <table className="mt-3 w-full text-xs">
        <thead className="text-left text-2xs text-fg-subtle">
          <tr>
            <th className="py-1 font-normal">Opened (local)</th>
            <th className="py-1 font-normal">Shift</th>
            <th className="py-1 text-right font-normal">Wait h</th>
            <th className="py-1 text-right font-normal">Down h</th>
            <th className="py-1 text-right font-normal">Cost</th>
          </tr>
        </thead>
        <tbody className="mono">
          {list.map((t) => (
            <tr key={t.opened} className="border-t border-divider">
              <td className="py-1.5 text-fg">{t.opened}</td>
              <td className="py-1.5 font-sans text-fg-muted">{t.shift}</td>
              <td className="py-1.5 text-right">{t.wait_hours.toFixed(1)}</td>
              <td className="py-1.5 text-right">{t.down_hours.toFixed(1)}</td>
              <td className="py-1.5 text-right">{fmt.usd(t.repair_cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
