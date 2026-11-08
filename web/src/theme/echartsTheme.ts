import { BarChart, BoxplotChart, CustomChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { colors, fonts, verdictColors } from "./tokens";

echarts.use([
  BarChart,
  BoxplotChart,
  CustomChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export { echarts };
export const THEME = "gilded";

let registered = false;

/** Linear-quiet: dashed horizontal gridlines only, 11px ticks, no axis lines, neutral series + gold highlight. */
export function registerTheme(): void {
  if (registered) return;
  registered = true;
  const label = { color: colors["fg-subtle"], fontFamily: fonts.sans, fontSize: 12 };
  const cat = {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: label,
    splitLine: { show: false },
    nameTextStyle: label,
  };
  const val = { ...cat, splitLine: { show: true, lineStyle: { color: colors.divider, type: [4, 4] as number[] } } };
  echarts.registerTheme(THEME, {
    color: [colors.maroon, colors["fg-subtle"], colors.gold, verdictColors.luck, verdictColors.downtime, verdictColors.inspect_hold, colors["gold-soft"]],
    backgroundColor: "transparent",
    textStyle: { fontFamily: fonts.sans, color: colors.fg, fontSize: 13 },
    title: { show: false },
    legend: { show: false, textStyle: label },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: tooltipStyle,
    categoryAxis: cat,
    valueAxis: val,
    timeAxis: cat,
    line: { symbol: "none", lineStyle: { width: 1.5 }, emphasis: { lineStyle: { width: 2 } } },
    bar: { itemStyle: { borderRadius: [3, 3, 0, 0] }, barMaxWidth: 28 },
    scatter: { symbolSize: 6 },
  });
}

/** The one tooltip: surface-3 card, hairline ring, mono numbers. */
export const tooltipStyle = {
  backgroundColor: colors["surface-3"],
  borderColor: colors.divider,
  borderWidth: 1,
  padding: [10, 12],
  extraCssText: "border-radius:10px;box-shadow:0 2px 4px rgba(31,23,22,.08),0 18px 40px -16px rgba(31,23,22,.32);",
  textStyle: { color: colors.fg, fontFamily: fonts.sans, fontSize: 13 },
  axisPointer: { lineStyle: { color: colors["ring-strong"] }, crossStyle: { color: colors["ring-strong"] } },
};

/** Tooltip body: title + rows of [swatch, label, value]. Values render mono. */
export function tipHtml(title: string, rows: [string, string, string?][]): string {
  const r = rows
    .map(
      ([k, v, c]) =>
        `<div style="display:flex;gap:12px;justify-content:space-between;align-items:center;line-height:20px">` +
        `<span style="color:${colors["fg-muted"]};display:flex;align-items:center;gap:6px">${c ? `<i style="width:6px;height:6px;border-radius:9px;background:${c};display:inline-block"></i>` : ""}${k}</span>` +
        `<span style="font-family:${fonts.mono};font-size:13px">${v}</span></div>`,
    )
    .join("");
  return `<div style="min-width:160px"><div style="font-weight:600;margin-bottom:4px">${title}</div>${r}</div>`;
}

/** Vertical gradient fill for an area series. */
export const areaFill = (hex: string, a = 0.22) =>
  new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: hex + Math.round(a * 255).toString(16).padStart(2, "0") },
    { offset: 1, color: hex + "00" },
  ]);
