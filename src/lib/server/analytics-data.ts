import { unstable_cache } from "next/cache";

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

export type AnalyticsData = {
  range: string;
  availableYears: number[];
  trend: Array<{ bucket: string; amount: number }>;
  brandShare: Array<{ brand: string; amount: number }>;
  categoryShare: Array<{ category: string; amount: number }>;
  frequency: Array<{ bucket: string; count: number }>;
  shuttleInsights: {
    longestHold: { name: string | null; days?: number | null; purchaseDate?: string | null; usedUpAt?: string | null };
    largestStock: { name: string | null; quantity?: number | null; purchaseDate?: string | null };
    favoritePurchase: { name: string | null; quantity?: number | null };
    oldestCurrentStock: { name: string | null; days?: number | null; quantity?: number | null; purchaseDate?: string | null };
  };
  wishlistCounts: Array<{ status: "WANT" | "WATCHING" | "PURCHASED" | "DROPPED"; count: number }>;
  gearRanking: Array<{ id: string; name: string; overall: number }>;
};

export const ANALYTICS_FULL_TAG = "analytics-full";

export const getCachedAnalyticsAvailableYears = unstable_cache(
  async () => getAnalyticsAvailableYears(),
  ["analytics-available-years"],
  {
    tags: [ANALYTICS_FULL_TAG],
    revalidate: 60
  }
);

export const getCachedAnalyticsFullData = unstable_cache(
  async (range: string): Promise<AnalyticsData> => {
    const [availableYears, trend, brandShare, categoryShare, frequency, shuttleInsights, wishlistCounts, gearRanking] = await Promise.all([
      getCachedAnalyticsAvailableYears(),
      getSpendingTrend(range),
      getBrandShare(range),
      getCategoryShare(range),
      getPurchaseFrequency("month", range),
      getShuttleInsights(range),
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

    return {
      range,
      availableYears,
      trend: trend.map((item) => ({
        bucket: item.bucket instanceof Date ? item.bucket.toISOString() : String(item.bucket),
        amount: Number(item.amount)
      })),
      brandShare: brandShare.map((item) => ({ brand: item.brand, amount: Number(item.amount) })),
      categoryShare: categoryShare.map((item) => ({ category: item.category, amount: Number(item.amount) })),
      frequency: frequency.map((item) => ({
        bucket: item.bucket instanceof Date ? item.bucket.toISOString() : String(item.bucket),
        count: Number(item.count)
      })),
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
  },
  ["analytics-full-data"],
  {
    tags: [ANALYTICS_FULL_TAG],
    revalidate: 60
  }
);
