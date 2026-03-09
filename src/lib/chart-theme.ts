/**
 * 图表统一主题配置
 * 基于 Tailwind 500 级色阶，饱和度一致，深浅色模式均适配。
 */

/** 图表多系列色盘（7色） */
export const CHART_COLORS = [
    "#3b82f6", // Blue-500
    "#10b981", // Emerald-500
    "#f59e0b", // Amber-500
    "#8b5cf6", // Violet-500
    "#ef4444", // Red-500
    "#06b6d4", // Cyan-500
    "#f97316", // Orange-500
];

/** 单系列主色（折线/柱状图默认） */
export const CHART_PRIMARY = CHART_COLORS[0]; // Blue-500
export const CHART_SECONDARY = CHART_COLORS[1]; // Emerald-500
export const CHART_TERTIARY = CHART_COLORS[2]; // Amber-500

/** 根据当前主题生成 ECharts 基础样式对象（轴标签、网格线、Tooltip） */
export function chartBase(isDark: boolean) {
    const labelColor = isDark ? "#a1a1aa" : "#71717a"; // zinc-400 / zinc-500
    const lineColor = isDark ? "rgba(250,250,250,0.08)" : "rgba(9,9,11,0.07)";
    const tooltipBg = isDark ? "#18181b" : "#ffffff";
    const tooltipBorder = isDark ? "rgba(250,250,250,0.1)" : "rgba(9,9,11,0.08)";

    return {
        color: CHART_COLORS,
        backgroundColor: "transparent",
        textStyle: { fontFamily: "var(--font-body, sans-serif)", color: labelColor },
        grid: {
            top: 16,
            right: 16,
            bottom: 32,
            left: 48,
            containLabel: true,
        },
        tooltip: {
            backgroundColor: tooltipBg,
            borderColor: tooltipBorder,
            borderWidth: 1,
            textStyle: { color: isDark ? "#fafafa" : "#09090b", fontSize: 13 },
            extraCssText: `box-shadow: 0 4px 16px rgba(0,0,0,${isDark ? 0.5 : 0.12}); border-radius: 12px;`,
        },
        axisLabel: { color: labelColor, fontSize: 12 },
        splitLine: { lineStyle: { color: lineColor } },
    };
}
