"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { currency } from "@/lib/utils";
import { chartBase, CHART_COLORS, CHART_PRIMARY, CHART_SECONDARY, CHART_TERTIARY } from "@/lib/chart-theme";

type WishlistCountItem = {
  status: "WANT" | "WATCHING" | "PURCHASED" | "DROPPED";
  count: number;
};

type AnalyticsData = {
  range?: string;
  availableYears?: number[];
  trend?: Array<{ bucket: string; amount: number }>;
  brandShare?: Array<{ brand: string; amount: number }>;
  categoryShare?: Array<{ category: string; amount: number }>;
  frequency?: Array<{ bucket: string; count: number }>;
  shuttleInsights?: {
    longestHold: { name: string | null; days?: number | null; purchaseDate?: string | null; usedUpAt?: string | null };
    largestStock: { name: string | null; quantity?: number | null; purchaseDate?: string | null };
    favoritePurchase: { name: string | null; quantity?: number | null };
    oldestCurrentStock: { name: string | null; days?: number | null; quantity?: number | null; purchaseDate?: string | null };
  };
  wishlistCounts?: WishlistCountItem[];
  gearRanking?: Array<{ id: string; name: string; overall: number | string }>;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const EChart = dynamic(
  () => import("@/components/charts/EChart").then((m) => ({ default: m.EChart })),
  {
    ssr: false,
    loading: () => <div className="h-80 animate-pulse rounded-2xl bg-panel" />,
  }
);

/** 判断当前是否深色模式（读取 html[data-theme]） */
function useIsDark() {
  if (typeof window === "undefined") return true;
  return document.documentElement.getAttribute("data-theme") !== "light";
}

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ControlPanel } from "@/components/ui/ControlPanel";

export function AnalyticsBoard({
  fallbackData,
}: {
  fallbackData?: AnalyticsData;
} = {}) {
  const defaultRange = fallbackData?.range ?? (fallbackData?.availableYears?.[0] ? String(fallbackData.availableYears[0]) : "all");
  const [range, setRange] = useState(defaultRange);
  const isDark = useIsDark();

  const { data: fullData, isLoading: loading, error: fetchError } =
    useSWR<AnalyticsData>(`/api/analytics/full?range=${range}`, fetcher, {
      fallbackData: range === defaultRange ? fallbackData : undefined,
    });
  const error = fetchError ? "加载分析数据失败" : null;

  const base = chartBase(isDark);

  const trend = useMemo(
    () => (fullData?.trend ?? []).map((item) => ({ bucket: item.bucket, amount: Number(item.amount) })),
    [fullData]
  );
  const brandShare = useMemo(
    () => (fullData?.brandShare ?? []).map((item) => ({ brand: item.brand, amount: Number(item.amount) })),
    [fullData]
  );
  const categoryShare = useMemo(
    () =>
      (fullData?.categoryShare ?? []).map((item) => ({
        category: item.category,
        amount: Number(item.amount),
      })),
    [fullData]
  );
  const frequency = useMemo(
    () => (fullData?.frequency ?? []).map((item) => ({ bucket: item.bucket, count: Number(item.count) })),
    [fullData]
  );
  const wishlistCounts = fullData?.wishlistCounts ?? [];
  const shuttleInsights = fullData?.shuttleInsights;
  const gearRanking = useMemo(
    () =>
      (fullData?.gearRanking ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        overall: Number(item.overall),
      })),
    [fullData]
  );

  const availableYears = fullData?.availableYears ?? fallbackData?.availableYears ?? [];
  const yearOptions = useMemo(
    () => [...availableYears].sort((a, b) => b - a),
    [availableYears]
  );

  const rangeOptions = useMemo(() => [
    { id: "all", label: "全部历史" },
    ...yearOptions.map(year => ({ id: String(year), label: `${year}年` }))
  ], [yearOptions]);

  const totalSpending = useMemo(
    () => trend.reduce((sum, item) => sum + Number(item.amount), 0),
    [trend]
  );
  const rangeLabel = useMemo(() => {
    if (range === "all") return "全部历史";
    return `${range} 年`;
  }, [range]);
  const shuttleInsightCards = useMemo(
    () => [
      {
        label: "屯最久",
        value:
          shuttleInsights?.longestHold.days != null
            ? `${shuttleInsights.longestHold.days} 天`
            : "暂无数据",
        name: shuttleInsights?.longestHold.name ?? null,
        hint:
          shuttleInsights?.longestHold.purchaseDate && shuttleInsights?.longestHold.usedUpAt
            ? `${shuttleInsights.longestHold.purchaseDate.slice(0, 10)} → ${shuttleInsights.longestHold.usedUpAt.slice(0, 10)}`
            : "需要先通过“用完”按钮积累数据"
      },
      {
        label: "屯最多",
        value:
          shuttleInsights?.largestStock.quantity != null
            ? `${shuttleInsights.largestStock.quantity} 桶`
            : "暂无库存",
        name: shuttleInsights?.largestStock.name ?? null,
        hint:
          shuttleInsights?.largestStock.purchaseDate
            ? `最早库存购入于 ${shuttleInsights.largestStock.purchaseDate.slice(0, 10)}`
            : "当前在用/闲置库存统计"
      },
      {
        label: "最爱购买",
        value:
          shuttleInsights?.favoritePurchase.quantity != null
            ? `${shuttleInsights.favoritePurchase.quantity} 桶`
            : "暂无数据",
        name: shuttleInsights?.favoritePurchase.name ?? null,
        hint: "按累计购买数量统计"
      },
      {
        label: "当前最老库存",
        value:
          shuttleInsights?.oldestCurrentStock.days != null
            ? `${shuttleInsights.oldestCurrentStock.days} 天`
            : "暂无库存",
        name: shuttleInsights?.oldestCurrentStock.name ?? null,
        hint:
          shuttleInsights?.oldestCurrentStock.purchaseDate
            ? `购入于 ${shuttleInsights.oldestCurrentStock.purchaseDate.slice(0, 10)}`
            : "按当前未用完库存统计"
      }
    ],
    [shuttleInsights]
  );

  // ── 图表 Option（均使用色盘，无硬编码颜色）──────────────────────────────

  const trendOption = useMemo(
    () => ({
      ...base,
      tooltip: { ...base.tooltip, trigger: "axis" },
      xAxis: {
        type: "category",
        data: trend.map((item) => item.bucket.slice(0, 7)),
        axisLabel: base.axisLabel,
        axisLine: { lineStyle: { color: base.splitLine.lineStyle.color } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: base.axisLabel,
        splitLine: base.splitLine,
      },
      series: [
        {
          type: "line",
          smooth: true,
          data: trend.map((item) => item.amount),
          lineStyle: { color: CHART_PRIMARY, width: 2.5 },
          itemStyle: { color: CHART_PRIMARY },
          areaStyle: {
            color: {
              type: "linear",
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `${CHART_PRIMARY}40` },
                { offset: 1, color: `${CHART_PRIMARY}06` },
              ],
            },
          },
          symbol: "circle",
          symbolSize: 6,
        },
      ],
    }),
    [trend, base]
  );

  const brandOption = useMemo(
    () => ({
      ...base,
      tooltip: { ...base.tooltip, trigger: "item" },
      legend: {
        bottom: 0,
        textStyle: { color: base.textStyle.color, fontSize: 12 },
        icon: "circle",
      },
      series: [
        {
          type: "pie",
          radius: ["40%", "70%"],
          data: brandShare.map((item) => ({ name: item.brand, value: item.amount })),
          label: { show: false },
          emphasis: {
            itemStyle: { shadowBlur: 16, shadowColor: "rgba(0,0,0,0.25)" },
          },
        },
      ],
    }),
    [brandShare, base]
  );

  const categoryOption = useMemo(
    () => ({
      ...base,
      tooltip: { ...base.tooltip, trigger: "axis" },
      xAxis: {
        type: "category",
        data: categoryShare.map((item) => item.category),
        axisLabel: { ...base.axisLabel, rotate: 30 },
        axisLine: { lineStyle: { color: base.splitLine.lineStyle.color } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: base.axisLabel,
        splitLine: base.splitLine,
      },
      series: [
        {
          type: "bar",
          data: categoryShare.map((item) => item.amount),
          itemStyle: {
            color: CHART_SECONDARY,
            borderRadius: [6, 6, 0, 0],
          },
          barMaxWidth: 48,
        },
      ],
    }),
    [categoryShare, base]
  );

  const frequencyOption = useMemo(
    () => ({
      ...base,
      tooltip: { ...base.tooltip, trigger: "axis" },
      xAxis: {
        type: "category",
        data: frequency.map((item) => item.bucket.slice(0, 7)),
        axisLabel: base.axisLabel,
        axisLine: { lineStyle: { color: base.splitLine.lineStyle.color } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: base.axisLabel,
        splitLine: base.splitLine,
        minInterval: 1,
      },
      series: [
        {
          type: "bar",
          data: frequency.map((item) => item.count),
          itemStyle: {
            color: CHART_TERTIARY,
            borderRadius: [6, 6, 0, 0],
          },
          barMaxWidth: 40,
        },
      ],
    }),
    [frequency, base]
  );

  const funnelData = useMemo(() => {
    const statusCount = new Map(wishlistCounts.map((item) => [item.status, item.count]));
    const want = statusCount.get("WANT") ?? 0;
    const watching = statusCount.get("WATCHING") ?? 0;
    const purchased = statusCount.get("PURCHASED") ?? 0;
    const total = Math.max(want, 1);

    return [
      { name: "心动 WANT", value: want, pct: (want / total) * 100, color: CHART_COLORS[0] },
      { name: "观望 WATCHING", value: watching, pct: (watching / total) * 100, color: CHART_COLORS[2] },
      { name: "已购 PURCHASED", value: purchased, pct: (purchased / total) * 100, color: CHART_COLORS[1] },
    ];
  }, [wishlistCounts]);

  return (
    <div className="space-y-6">
      <ControlPanel
        right={
          <div className="hidden items-center gap-3 md:flex">
            <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-panel-2/50 px-3 py-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
              <span className="text-[10px] uppercase tracking-wider text-mute">{rangeLabel}投入</span>
              <span className="h-3 w-[1px] bg-border/40" />
              <span className="font-display font-bold text-accent text-sm leading-none">{currency(totalSpending)}</span>
            </div>
          </div>
        }
      >
        <SegmentedControl
          options={rangeOptions}
          value={range}
          onChange={setRange}
        />
      </ControlPanel>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {shuttleInsightCards.map((item) => (
          <Card key={item.label}>
            <div className="text-xs uppercase tracking-[0.24em] text-mute">{item.label}</div>
            <div className="mt-3 font-display text-2xl text-accent">{item.value}</div>
            <div className="mt-3 line-clamp-1 text-sm font-medium text-text">{item.name ?? "未形成有效统计"}</div>
            <div className="mt-1 text-xs leading-5 text-text-mute">{item.hint}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-display text-lg text-accent">月度投入趋势</h3>
          <p className="-mt-2 mb-4 text-xs uppercase tracking-[0.24em] text-mute">{rangeLabel}</p>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative h-80 overflow-hidden rounded-2xl bg-panel-2 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent"
              />
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
              >
                <EChart option={trendOption} />
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
        <Card>
          <h3 className="mb-4 font-display text-lg text-accent">品牌投入占比</h3>
          <p className="-mt-2 mb-4 text-xs uppercase tracking-[0.24em] text-mute">{rangeLabel}</p>
          {loading ? <div className="relative h-80 overflow-hidden rounded-2xl bg-panel-2 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" /> : <EChart option={brandOption} />}
        </Card>
        <Card>
          <h3 className="mb-4 font-display text-lg text-accent">品类投入对比</h3>
          <p className="-mt-2 mb-4 text-xs uppercase tracking-[0.24em] text-mute">{rangeLabel}</p>
          {loading ? <div className="relative h-80 overflow-hidden rounded-2xl bg-panel-2 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" /> : <EChart option={categoryOption} />}
        </Card>
        <Card>
          <h3 className="mb-4 font-display text-lg text-accent">购买频率（月）</h3>
          <p className="-mt-2 mb-4 text-xs uppercase tracking-[0.24em] text-mute">{rangeLabel}</p>
          {loading ? <div className="relative h-80 overflow-hidden rounded-2xl bg-panel-2 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent" /> : <EChart option={frequencyOption} />}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h3 className="mb-4 font-display text-lg text-accent">心愿单转化漏斗</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-6 animate-pulse rounded-full bg-panel" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {funnelData.map((item) => (
                <div key={item.name}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-mute">{item.name}</span>
                    <span className="font-medium text-text">{item.value}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border/60">
                    <div
                      className="h-2 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="mb-4 font-display text-lg text-accent">装备评分排行榜</h3>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-8 animate-pulse rounded-xl bg-panel" />)}
            </div>
          ) : (
            <ol className="space-y-2.5 text-sm">
              {gearRanking.map((item, index) => (
                <li key={item.id} className="flex items-center gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                  >
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-text">{item.name}</span>
                  <span className="font-medium tabular-nums text-accent">{item.overall.toFixed(1)}</span>
                </li>
              ))}
              {!gearRanking.length ? <li className="text-mute">暂无评分数据</li> : null}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
