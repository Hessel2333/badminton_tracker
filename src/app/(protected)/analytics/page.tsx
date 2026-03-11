import {
  getAnalyticsAvailableYears,
  getBrandShare,
  getCategoryShare,
  getPurchaseFrequency,
  getShuttleInsights,
  getSpendingTrend
} from "@/lib/analytics/queries";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";
import { AnalyticsBoard } from "@/components/forms/AnalyticsBoard";
import { SectionTitle } from "@/components/ui/SectionTitle";

import { BarChart3 } from "lucide-react";

export const revalidate = 60; // 分析数据可用 60s 缓存

export default async function AnalyticsPage() {
  const availableYears = await getAnalyticsAvailableYears();
  const defaultRange = availableYears[0] ? String(availableYears[0]) : "all";

  const [trend, brandShare, categoryShare, frequency, shuttleInsights, wishlistCounts, gearRanking] =
    await Promise.all([
      getSpendingTrend(defaultRange),
      getBrandShare(defaultRange),
      getCategoryShare(defaultRange),
      getPurchaseFrequency("month", defaultRange),
      getShuttleInsights(defaultRange),
      prisma.wishlistItem.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.$queryRaw<Array<{ id: string; name: string; overall: number | string }>>`
        SELECT g.id, g.name, r.overall
        FROM gear_items g
        JOIN LATERAL (
          SELECT overall FROM gear_ratings
          WHERE gear_item_id = g.id
          ORDER BY rated_at DESC LIMIT 1
        ) r ON TRUE
        ORDER BY r.overall DESC LIMIT 8
      `
    ]);

  const fallbackData = {
    range: defaultRange,
    availableYears,
    trend: trend.map((item) => ({ ...item, bucket: item.bucket instanceof Date ? item.bucket.toISOString() : String(item.bucket) })),
    brandShare,
    categoryShare,
    frequency: frequency.map((item) => ({ ...item, bucket: item.bucket instanceof Date ? item.bucket.toISOString() : String(item.bucket) })),
    shuttleInsights: {
      longestHold: {
        ...shuttleInsights.longestHold,
        purchaseDate: shuttleInsights.longestHold.purchaseDate?.toISOString() ?? null,
        usedUpAt: shuttleInsights.longestHold.usedUpAt?.toISOString() ?? null
      },
      largestStock: {
        ...shuttleInsights.largestStock,
        purchaseDate: shuttleInsights.largestStock.purchaseDate?.toISOString() ?? null
      },
      favoritePurchase: shuttleInsights.favoritePurchase,
      oldestCurrentStock: {
        ...shuttleInsights.oldestCurrentStock,
        purchaseDate: shuttleInsights.oldestCurrentStock.purchaseDate?.toISOString() ?? null
      }
    },
    wishlistCounts: wishlistCounts.map((item) => ({
      status: item.status,
      count: item._count._all
    })),
    gearRanking: gearRanking.map((item) => ({
      id: item.id,
      name: item.name,
      overall: toNumber(item.overall)
    }))
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={BarChart3}
        title="分析看板"
        subtitle="投入趋势、品牌品类占比、频率、转化与评分排行。数据驱动决策，优化你的装备生命周期。"
      />
      <AnalyticsBoard fallbackData={fallbackData} />
    </div>
  );
}
