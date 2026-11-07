import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import { echarts, registerTheme, THEME } from "../theme/echartsTheme";

registerTheme();

/** Themed ECharts wrapper (tree-shaken core build). */
export function Chart({ option, height = 280, label }: { option: EChartsOption; height?: number; label: string }) {
  return (
    <div role="img" aria-label={label}>
      <ReactEChartsCore echarts={echarts} option={option} theme={THEME} style={{ height }} notMerge lazyUpdate />
    </div>
  );
}
