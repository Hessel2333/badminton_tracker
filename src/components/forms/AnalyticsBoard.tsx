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
  const topBrand = useMemo(
    () =>
      [...brandShare].sort((a, b) => b.amount - a.amount)[0] ?? null,
    [brandShare]
  );
  const topCategory = useMemo(
    () =>
      [...categoryShare].sort((a, b) => b.amount - a.amount)[0] ?? null,
    [categoryShare]
  );
  const topFrequencyBucket = useMemo(
    () =>
      [...frequency].sort((a, b) => b.count - a.count)[0] ?? null,
    [frequency]
  );
  const trendHeadline = useMemo(() => {
    const latest = trend.at(-1) ?? null;
    const previous = trend.at(-2) ?? null;

    if (!latest) {
      return {
        title: "当前还没有形成有效投入趋势",
        summary: "先从购买记录里补够几次真实消费，分析页才会开始给出更可靠的判断。",
        hint: "建议先在购买页补齐价格、状态和时间。"
      };
    }

    if (!previous) {
      return {
        title: `${rangeLabel}投入主要集中在 ${latest.bucket.slice(0, 7)}`,
        summary: `目前能确认的累计投入为 ${currency(latest.amount)}，还需要更多历史记录才能看出波动方向。`,
        hint: "至少需要两个时间点，趋势判断才有意义。"
      };
    }

    const delta = latest.amount - previous.amount;
    const direction =
      delta > 0 ? "抬升" : delta < 0 ? "回落" : "持平";
    const deltaText = currency(Math.abs(delta));

    return {
      title: `${latest.bucket.slice(0, 7)} 的投入相较上一个周期${direction}`,
      summary:
        delta === 0
          ? `两个连续周期都维持在 ${currency(latest.amount)} 左右，最近的购买节奏比较稳定。`
          : `最新周期投入为 ${currency(latest.amount)}，变化幅度 ${deltaText}。先确认这次波动来自补库存、换主力还是临时尝试。`,
      hint:
        topCategory && topBrand
          ? `当前最吃预算的是 ${topCategory.category}，而 ${topBrand.brand} 是目前占比最高的品牌。`
          : "再结合下面的品牌和品类占比，可以更快定位预算重心。"
    };
  }, [rangeLabel, topBrand, topCategory, trend]);

  const preferenceHighlights = useMemo(
    () => [
      {
        label: "主投入品牌",
        value: topBrand ? topBrand.brand : "暂无数据",
        hint: topBrand ? `${currency(topBrand.amount)}，当前占用最多预算` : "还没有形成品牌偏好"
      },
      {
        label: "主投入品类",
        value: topCategory ? topCategory.category : "暂无数据",
        hint: topCategory ? `${currency(topCategory.amount)}，是当前最重的投入方向` : "还没有形成品类偏好"
      },
      {
        label: "最活跃周期",
        value: topFrequencyBucket ? topFrequencyBucket.bucket.slice(0, 7) : "暂无数据",
        hint: topFrequencyBucket ? `${topFrequencyBucket.count} 次购买，适合回看是否属于补货高峰` : "还没有形成稳定购买节奏"
      }
    ],
    [topBrand, topCategory, topFrequencyBucket]
  );

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
          <div className="hidden md:flex items-center gap-3">
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <Card>
          <div className="text-xs uppercase tracking-[0.24em] text-mute">本期判断</div>
          <div className="mt-3 max-w-2xl">
            <h3 className="font-display text-2xl leading-tight text-accent">{trendHeadline.title}</h3>
            <p className="mt-3 text-sm leading-7 text-text">{trendHeadline.summary}</p>
            <p className="mt-2 text-sm leading-7 text-text-mute">{trendHeadline.hint}</p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-border bg-panel-2/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-mute">{rangeLabel}总投入</div>
              <div className="mt-2 font-display text-xl text-text">{currency(totalSpending)}</div>
            </div>
            <div className="rounded-[22px] border border-border bg-panel-2/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-mute">预算焦点</div>
              <div className="mt-2 text-base font-semibold text-text">{topCategory?.category ?? "暂无数据"}</div>
              <div className="mt-1 text-xs text-text-mute">
                {topCategory ? currency(topCategory.amount) : "补够购买记录后会出现"}
              </div>
            </div>
            <div className="rounded-[22px] border border-border bg-panel-2/80 px-4 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-mute">品牌偏重</div>
              <div className="mt-2 text-base font-semibold text-text">{topBrand?.brand ?? "暂无数据"}</div>
              <div className="mt-1 text-xs text-text-mute">
                {topBrand ? currency(topBrand.amount) : "补够购买记录后会出现"}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-[0.24em] text-mute">偏好切片</div>
          <div className="mt-4 space-y-3">
            {preferenceHighlights.map((item) => (
              <div key={item.label} className="rounded-[22px] border border-border bg-panel-2/75 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-mute">{item.label}</div>
                <div className="mt-2 text-base font-semibold text-text">{item.value}</div>
                <div className="mt-1 text-xs leading-6 text-text-mute">{item.hint}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

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
