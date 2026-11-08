import ReactEChartsCoreMod from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import { echarts, registerTheme, THEME } from "../theme/echartsTheme";

registerTheme();

// CJS module: some bundles hand back { default: Component } instead of the component.
const ReactEChartsCore = ((ReactEChartsCoreMod as unknown as { default?: typeof ReactEChartsCoreMod }).default ??
  ReactEChartsCoreMod) as typeof ReactEChartsCoreMod;

/** Themed ECharts wrapper (tree-shaken core build). */
export function Chart({ option, height = 280, label }: { option: EChartsOption; height?: number; label: string }) {
  return (
    <div role="img" aria-label={label}>
      <ReactEChartsCore echarts={echarts} option={option} theme={THEME} style={{ height }} notMerge lazyUpdate />
    </div>
  );
}
