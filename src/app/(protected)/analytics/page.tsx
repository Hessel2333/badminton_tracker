import {
  getBrandShare,
  getCategoryShare,
  getPurchaseFrequency,
  getSpendingTrend
} from "@/lib/analytics/queries";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";
import { AnalyticsBoard } from "@/components/forms/AnalyticsBoard";
import { SectionTitle } from "@/components/ui/SectionTitle";

export const revalidate = 60; // 分析数据可用 60s 缓存

export default async function AnalyticsPage() {
  const [trend, brandShare, categoryShare, frequency, wishlistCounts, gearRanking] =
    await Promise.all([
      getSpendingTrend("12m"),
      getBrandShare("12m"),
      getCategoryShare("12m"),
      getPurchaseFrequency("month", "12m"),
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
    trend: trend.map((item) => ({ ...item, bucket: item.bucket instanceof Date ? item.bucket.toISOString() : String(item.bucket) })),
    brandShare,
    categoryShare,
    frequency: frequency.map((item) => ({ ...item, bucket: item.bucket instanceof Date ? item.bucket.toISOString() : String(item.bucket) })),
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
        title="分析看板"
        subtitle="投入趋势、品牌品类占比、频率、转化与评分排行。"
      />
      <AnalyticsBoard fallbackData={fallbackData} />
    </div>
  );
}
