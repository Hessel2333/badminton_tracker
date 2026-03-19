"use client";

import ReactECharts from "echarts-for-react";

export function EChart({ option, height = 320 }: { option: unknown; height?: number }) {
  return <ReactECharts option={option} style={{ height }} opts={{ renderer: "canvas" }} />;
}
