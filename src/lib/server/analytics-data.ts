import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";

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
const SNAPSHOT_FRESH_MAX_AGE_MS = 5 * 60_000;
const SNAPSHOT_STALE_MAX_AGE_MS = 60 * 60_000;

type SnapshotRow = {
  payload_json: Prisma.JsonValue;
  refreshed_at: Date;
};

type SnapshotResult = {
  payload: AnalyticsData;
  refreshedAt: Date;
  ageMs: number;
  isFresh: boolean;
};

async function readAnalyticsSnapshot(userId: string, range: string): Promise<SnapshotResult | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<SnapshotRow[]>(
      `
        SELECT payload_json, refreshed_at
        FROM analytics_snapshots
        WHERE user_id = $1
          AND range_key = $2
        LIMIT 1
      `,
      userId,
      range
    );

    const row = rows[0];
    if (!row) return null;

    const refreshedAt = new Date(row.refreshed_at);
    const ageMs = Date.now() - refreshedAt.getTime();
    if (ageMs > SNAPSHOT_STALE_MAX_AGE_MS) return null;

    return {
      payload: row.payload_json as AnalyticsData,
      refreshedAt,
      ageMs,
      isFresh: ageMs <= SNAPSHOT_FRESH_MAX_AGE_MS
    };
  } catch (error) {
    console.warn("[perf] analytics snapshot read failed", error);
    return null;
  }
}

async function writeAnalyticsSnapshot(userId: string, range: string, payload: AnalyticsData) {
  try {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO analytics_snapshots (user_id, range_key, payload_json, refreshed_at, created_at, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW(), NOW(), NOW())
        ON CONFLICT (user_id, range_key)
        DO UPDATE SET
          payload_json = EXCLUDED.payload_json,
          refreshed_at = NOW(),
          updated_at = NOW()
      `,
      userId,
      range,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn("[perf] analytics snapshot write failed", error);
  }
}

export const getCachedAnalyticsAvailableYears = unstable_cache(
  async (userId: string) => getAnalyticsAvailableYears(userId),
  ["analytics-available-years"],
  {
    tags: [ANALYTICS_FULL_TAG],
    revalidate: 60
  }
);

const refreshInFlight = new Map<string, Promise<void>>();

async function rebuildAndWriteSnapshot(userId: string, range: string) {
  const key = `${userId}:${range}`;
  const existing = refreshInFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      const payload = await buildAnalyticsFullData(userId, range, { allowStaleSnapshot: false });
      await writeAnalyticsSnapshot(userId, range, payload);
    } catch (error) {
      console.warn("[perf] analytics snapshot refresh failed", error);
    } finally {
      refreshInFlight.delete(key);
    }
  })();

  refreshInFlight.set(key, task);
  return task;
}

async function buildAnalyticsFullData(
  userId: string,
  range: string,
  options: { allowStaleSnapshot: boolean } = { allowStaleSnapshot: true }
): Promise<AnalyticsData> {
  const snapshot = await readAnalyticsSnapshot(userId, range);
  if (snapshot) {
    if (snapshot.isFresh) return snapshot.payload;

    // 缓存过期但仍可用：先返回旧数据，后台刷新，避免偶发 10s+ 阻塞（range=all 特别明显）
    if (options.allowStaleSnapshot) {
      void rebuildAndWriteSnapshot(userId, range);
      return snapshot.payload;
    }
  }

  const [availableYears, trend, brandShare, categoryShare, frequency, shuttleInsights, wishlistCounts, gearRanking] =
    await Promise.all([
      getCachedAnalyticsAvailableYears(userId),
      getSpendingTrend(userId, range),
      getBrandShare(userId, range),
      getCategoryShare(userId, range),
      getPurchaseFrequency(userId, "month", range),
      getShuttleInsights(userId, range),
      prisma.wishlistItem.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
      prisma.$queryRaw<Array<{ id: string; name: string; overall: number | string }>>`
        SELECT g.id, g.name, r.overall
        FROM gear_items g
        JOIN LATERAL (
          SELECT overall FROM gear_ratings
          WHERE gear_item_id = g.id
          ORDER BY rated_at DESC LIMIT 1
        ) r ON TRUE
        WHERE g.user_id = ${userId}
        ORDER BY r.overall DESC LIMIT 8
      `
    ]);

  const payload: AnalyticsData = {
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

  return payload;
}

export const getCachedAnalyticsFullData = unstable_cache(async (userId: string, range: string): Promise<AnalyticsData> => buildAnalyticsFullData(userId, range), ["analytics-full-data"], {
  tags: [ANALYTICS_FULL_TAG],
  revalidate: 60
});
