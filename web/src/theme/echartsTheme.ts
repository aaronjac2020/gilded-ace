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

/** Register the ECharts theme once, built from tokens. */
export function registerTheme(): void {
  if (registered) return;
  registered = true;
  const axis = {
    axisLine: { lineStyle: { color: colors.rule } },
    axisTick: { lineStyle: { color: colors.rule } },
    axisLabel: { color: colors.muted, fontFamily: fonts.sans },
    splitLine: { lineStyle: { color: colors.rule, type: "dashed" as const } },
    nameTextStyle: { color: colors.muted },
  };
  echarts.registerTheme(THEME, {
    color: [colors.gold, verdictColors.luck, verdictColors.downtime, verdictColors.inspect_hold, colors["gold-soft"], verdictColors.truly_weak],
    backgroundColor: "transparent",
    textStyle: { fontFamily: fonts.sans, color: colors.ink },
    title: { textStyle: { color: colors.ink, fontFamily: fonts.display } },
    legend: { textStyle: { color: colors.muted } },
    tooltip: {
      backgroundColor: colors["surface-2"],
      borderColor: colors.rule,
      textStyle: { color: colors.ink, fontFamily: fonts.sans },
    },
    categoryAxis: axis,
    valueAxis: axis,
    timeAxis: axis,
    line: { symbol: "none", lineStyle: { width: 2 } },
    bar: { itemStyle: { borderRadius: [3, 3, 0, 0] } },
  });
}
