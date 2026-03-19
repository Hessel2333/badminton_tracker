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
const SNAPSHOT_MAX_AGE_MS = 5 * 60_000;

type SnapshotRow = {
  payload_json: Prisma.JsonValue;
  refreshed_at: Date;
};

let snapshotTableEnsured: Promise<boolean> | null = null;

async function ensureAnalyticsSnapshotTable() {
  if (!snapshotTableEnsured) {
    snapshotTableEnsured = (async () => {
      try {
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS analytics_snapshots (
            range_key TEXT PRIMARY KEY,
            payload_json JSONB NOT NULL,
            refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        return true;
      } catch (error) {
        console.warn("[perf] analytics snapshot table unavailable", error);
        return false;
      }
    })();
  }

  return snapshotTableEnsured;
}

async function readAnalyticsSnapshot(range: string): Promise<AnalyticsData | null> {
  if (!(await ensureAnalyticsSnapshotTable())) return null;

  try {
    const rows = await prisma.$queryRawUnsafe<SnapshotRow[]>(
      `
        SELECT payload_json, refreshed_at
        FROM analytics_snapshots
        WHERE range_key = $1
        LIMIT 1
      `,
      range
    );

    const row = rows[0];
    if (!row) return null;

    const refreshedAt = new Date(row.refreshed_at);
    if (Date.now() - refreshedAt.getTime() > SNAPSHOT_MAX_AGE_MS) {
      return null;
    }

    return row.payload_json as AnalyticsData;
  } catch (error) {
    console.warn("[perf] analytics snapshot read failed", error);
    return null;
  }
}

async function writeAnalyticsSnapshot(range: string, payload: AnalyticsData) {
  if (!(await ensureAnalyticsSnapshotTable())) return;

  try {
    await prisma.$executeRawUnsafe(
      `
        INSERT INTO analytics_snapshots (range_key, payload_json, refreshed_at, created_at, updated_at)
        VALUES ($1, $2::jsonb, NOW(), NOW(), NOW())
        ON CONFLICT (range_key)
        DO UPDATE SET
          payload_json = EXCLUDED.payload_json,
          refreshed_at = NOW(),
          updated_at = NOW()
      `,
      range,
      JSON.stringify(payload)
    );
  } catch (error) {
    console.warn("[perf] analytics snapshot write failed", error);
  }
}

export const getCachedAnalyticsAvailableYears = unstable_cache(
  async () => getAnalyticsAvailableYears(),
  ["analytics-available-years"],
  {
    tags: [ANALYTICS_FULL_TAG],
    revalidate: 60
  }
);

async function buildAnalyticsFullData(range: string): Promise<AnalyticsData> {
  const snapshot = await readAnalyticsSnapshot(range);
  if (snapshot) {
    return snapshot;
  }

  const [availableYears, trend, brandShare, categoryShare, frequency, shuttleInsights, wishlistCounts, gearRanking] =
    await Promise.all([
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

  await writeAnalyticsSnapshot(range, payload);

  return payload;
}

export const getCachedAnalyticsFullData = unstable_cache(async (range: string): Promise<AnalyticsData> => buildAnalyticsFullData(range), ["analytics-full-data"], {
  tags: [ANALYTICS_FULL_TAG],
  revalidate: 60
});
