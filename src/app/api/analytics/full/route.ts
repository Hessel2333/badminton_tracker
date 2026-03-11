import { NextRequest, NextResponse } from "next/server";

import {
  getAnalyticsAvailableYears,
  getBrandShare,
  getCategoryShare,
  getPurchaseFrequency,
  getShuttleInsights,
  getSpendingTrend
} from "@/lib/analytics/queries";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { toNumber } from "@/lib/server/number";
import { rangeSchema } from "@/lib/validators/analytics";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const parsed = rangeSchema.safeParse({
    range: request.nextUrl.searchParams.get("range") ?? "all"
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const range = parsed.data.range;

  const [availableYears, trend, brandShare, categoryShare, frequency, shuttleInsights, wishlistCounts, gearRanking] = await Promise.all([
    getAnalyticsAvailableYears(),
    getSpendingTrend(range),
    getBrandShare(range),
    getCategoryShare(range),
    getPurchaseFrequency("month", range),
    getShuttleInsights(range),
    prisma.wishlistItem.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    prisma.$queryRaw<Array<{ id: string; name: string; overall: number | string }>>`
      SELECT
        g.id,
        g.name,
        r.overall
      FROM gear_items g
      JOIN LATERAL (
        SELECT overall
        FROM gear_ratings
        WHERE gear_item_id = g.id
        ORDER BY rated_at DESC
        LIMIT 1
      ) r ON TRUE
      ORDER BY r.overall DESC
      LIMIT 8
    `
  ]);

  return NextResponse.json({
    range,
    availableYears,
    trend,
    brandShare,
    categoryShare,
    frequency,
    shuttleInsights,
    wishlistCounts: wishlistCounts.map((item) => ({
      status: item.status,
      count: item._count._all
    })),
    gearRanking: gearRanking.map((item) => ({
      id: item.id,
      name: item.name,
      overall: toNumber(item.overall)
    }))
  });
}
