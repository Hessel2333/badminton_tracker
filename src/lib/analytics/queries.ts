import { Prisma } from "@prisma/client";
import {
  addMonths,
  addWeeks,
  differenceInCalendarDays,
  endOfYear,
  startOfYear,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { canonicalProductKey, canonicalProductName } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";

async function earliestPurchaseDate() {
  const row = await prisma.purchaseRecord.findFirst({
    orderBy: { purchaseDate: "asc" },
    select: { purchaseDate: true }
  });
  return row?.purchaseDate ?? null;
}

function parseYearRange(range: string) {
  const year = Number(range);
  return Number.isInteger(year) && year >= 2000 && year <= 3000 ? year : null;
}

export async function getAnalyticsAvailableYears() {
  const rows = await prisma.$queryRaw<Array<{ year: number | string }>>`
    SELECT DISTINCT EXTRACT(YEAR FROM purchase_date)::int AS year
    FROM purchase_records
    ORDER BY year DESC
  `;

  return rows
    .map((row) => Number(row.year))
    .filter((year) => Number.isInteger(year));
}

async function resolveRangeBounds(range = "all", granularity: "month" | "week" = "month") {
  if (range === "all") {
    const earliest = await earliestPurchaseDate();
    const fallback = granularity === "week"
      ? startOfWeek(new Date(), { weekStartsOn: 1 })
      : startOfMonth(new Date());
    const from = earliest
      ? granularity === "week"
        ? startOfWeek(earliest, { weekStartsOn: 1 })
        : startOfMonth(earliest)
      : fallback;
    const to = granularity === "week"
      ? startOfWeek(new Date(), { weekStartsOn: 1 })
      : startOfMonth(new Date());
    return { from, to };
  }

  const year = parseYearRange(range) ?? new Date().getFullYear();
  if (granularity === "week") {
    return {
      from: startOfWeek(startOfYear(new Date(year, 0, 1)), { weekStartsOn: 1 }),
      to: startOfWeek(endOfYear(new Date(year, 0, 1)), { weekStartsOn: 1 })
    };
  }

  return {
    from: startOfMonth(startOfYear(new Date(year, 0, 1))),
    to: startOfMonth(endOfYear(new Date(year, 0, 1)))
  };
}

function monthKey(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function weekKey(value: Date) {
  const normalized = startOfWeek(value, { weekStartsOn: 1 });
  return normalized.toISOString();
}

type ShuttleInsightItem = {
  name: string | null;
  days?: number | null;
  quantity?: number | null;
  purchaseDate?: Date | null;
  usedUpAt?: Date | null;
};

export type ShuttleInsights = {
  longestHold: ShuttleInsightItem;
  largestStock: ShuttleInsightItem;
  favoritePurchase: ShuttleInsightItem;
  oldestCurrentStock: ShuttleInsightItem;
};

function isShuttleRecord(input: { categoryName?: string | null; itemName: string; brandName?: string | null; modelCode?: string | null }) {
  const seed = [input.categoryName ?? "", input.itemName, input.brandName ?? "", input.modelCode ?? ""].join(" ");
  return /羽毛球|亚狮龙|rsl|as-50|as-40|as-30|超牌|威肯|翎美|精彩永恒/i.test(seed);
}

export async function getOverview() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [currentMonthSpend, totalSpend, wishlistStats, recentPurchases] = await Promise.all([
    prisma.purchaseRecord.aggregate({
      _sum: { totalPriceCny: true },
      where: {
        purchaseDate: {
          gte: monthStart
        }
      }
    }),
    prisma.purchaseRecord.aggregate({
      _sum: { totalPriceCny: true }
    }),
    prisma.wishlistItem.aggregate({
      _sum: { targetPriceCny: true }
    }),
    prisma.purchaseRecord.findMany({
      take: 5,
      orderBy: { purchaseDate: "desc" },
      include: {
        brand: true,
        category: true
      }
    })
  ]);

  return {
    currentMonthSpend: toNumber(currentMonthSpend._sum.totalPriceCny),
    totalSpend: toNumber(totalSpend._sum.totalPriceCny),
    wishlistTargetAmount: toNumber(wishlistStats._sum.targetPriceCny),
    recentPurchases: recentPurchases.map((item) => ({
      id: item.id,
      itemName: item.itemNameSnapshot,
      brand: item.brand?.name ?? "未知品牌",
      category: item.category?.name ?? "未分类",
      date: item.purchaseDate,
      totalPrice: toNumber(item.totalPriceCny)
    }))
  };
}

export async function getSpendingTrend(range = "all") {
  const { from, to } = await resolveRangeBounds(range, "month");

  const rows = await prisma.$queryRaw<
    Array<{ bucket: Date; amount: Prisma.Decimal | number | string }>
  >`
    SELECT
      date_trunc('month', purchase_date) AS bucket,
      SUM(total_price_cny) AS amount
    FROM purchase_records
    WHERE purchase_date >= ${from}
      AND purchase_date < ${addMonths(to, 1)}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const keyedRows = new Map(
    rows.map((row) => [monthKey(row.bucket), toNumber(row.amount)])
  );

  const result: Array<{ bucket: Date; amount: number }> = [];
  let bucket = startOfMonth(from);
  const end = startOfMonth(to);

  while (bucket.getTime() <= end.getTime()) {
    result.push({
      bucket,
      amount: keyedRows.get(monthKey(bucket)) ?? 0
    });
    bucket = addMonths(bucket, 1);
  }

  return result;
}

export async function getBrandShare(range = "all") {
  const bounds = await resolveRangeBounds(range, "month");

  const grouped = await prisma.purchaseRecord.groupBy({
    by: ["brandId"],
    where: {
      purchaseDate: {
        gte: bounds.from,
        lt: addMonths(bounds.to, 1)
      }
    },
    _sum: { totalPriceCny: true }
  });

  const brandIds = grouped.map((item) => item.brandId).filter((id): id is string => Boolean(id));

  const brands = brandIds.length
    ? await prisma.brand.findMany({ where: { id: { in: brandIds } } })
    : [];

  const map = new Map(brands.map((brand) => [brand.id, brand.name]));

  return grouped.map((item) => ({
    brandId: item.brandId,
    brand: item.brandId ? map.get(item.brandId) ?? "未知品牌" : "未指定品牌",
    amount: toNumber(item._sum.totalPriceCny)
  }));
}

export async function getCategoryShare(range = "all") {
  const bounds = await resolveRangeBounds(range, "month");

  const grouped = await prisma.purchaseRecord.groupBy({
    by: ["categoryId"],
    where: {
      purchaseDate: {
        gte: bounds.from,
        lt: addMonths(bounds.to, 1)
      }
    },
    _sum: { totalPriceCny: true }
  });

  const categoryIds = grouped
    .map((item) => item.categoryId)
    .filter((id): id is string => Boolean(id));

  const categories = categoryIds.length
    ? await prisma.category.findMany({ where: { id: { in: categoryIds } } })
    : [];

  const map = new Map(categories.map((item) => [item.id, item.name]));

  return grouped.map((item) => ({
    categoryId: item.categoryId,
    category: item.categoryId ? map.get(item.categoryId) ?? "未分类" : "未分类",
    amount: toNumber(item._sum.totalPriceCny)
  }));
}

export async function getPurchaseFrequency(granularity: "week" | "month", range = "all") {
  const trunc = granularity === "week" ? "week" : "month";
  const { from, to } = await resolveRangeBounds(range, granularity);

  const rows = await prisma.$queryRawUnsafe<Array<{ bucket: Date; count: bigint | number }>>(
    `
      SELECT
        date_trunc('${trunc}', purchase_date) AS bucket,
        COUNT(*) AS count
      FROM purchase_records
      WHERE purchase_date >= $1
        AND purchase_date < $2
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    from,
    granularity === "month" ? addMonths(to, 1) : addWeeks(to, 1)
  );

  const keyedRows = new Map(
    rows.map((row) => [
      granularity === "month" ? monthKey(row.bucket) : weekKey(row.bucket),
      typeof row.count === "bigint" ? Number(row.count) : Number(row.count)
    ])
  );

  if (granularity === "month") {
    const result: Array<{ bucket: Date; count: number }> = [];
    let bucket = startOfMonth(from);
    const end = startOfMonth(to);

    while (bucket.getTime() <= end.getTime()) {
      result.push({
        bucket,
        count: keyedRows.get(monthKey(bucket)) ?? 0
      });
      bucket = addMonths(bucket, 1);
    }

    return result;
  }

  const result: Array<{ bucket: Date; count: number }> = [];
  let bucket = startOfWeek(from, { weekStartsOn: 1 });
  const end = startOfWeek(to, { weekStartsOn: 1 });

  while (bucket.getTime() <= end.getTime()) {
    result.push({
      bucket,
      count: keyedRows.get(weekKey(bucket)) ?? 0
    });
    bucket = addWeeks(bucket, 1);
  }

  return result;
}

export async function getShuttleInsights(range = "all"): Promise<ShuttleInsights> {
  const bounds = await resolveRangeBounds(range, "month");
  const records = await prisma.purchaseRecord.findMany({
    where: {
      purchaseDate: {
        gte: bounds.from,
        lt: addMonths(bounds.to, 1)
      }
    },
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      gearItem: { select: { modelCode: true } }
    }
  });

  const now = new Date();
  const grouped = new Map<
    string,
    {
      name: string;
      totalQty: number;
      activeQty: number;
      oldestActivePurchaseDate: Date | null;
      longestHoldDays: number | null;
      longestHoldPurchaseDate: Date | null;
      longestHoldUsedUpAt: Date | null;
    }
  >();

  for (const record of records) {
    const brandName = record.brand?.name ?? null;
    const categoryName = record.category?.name ?? null;
    const modelCode = record.gearItem?.modelCode ?? null;
    if (!isShuttleRecord({ categoryName, itemName: record.itemNameSnapshot, brandName, modelCode })) {
      continue;
    }

    const name = canonicalProductName({
      name: record.itemNameSnapshot,
      brandName,
      modelCode,
      categoryName
    });
    const key = canonicalProductKey({
      name: record.itemNameSnapshot,
      brandName,
      modelCode,
      categoryName
    });

    const current = grouped.get(key) ?? {
      name,
      totalQty: 0,
      activeQty: 0,
      oldestActivePurchaseDate: null,
      longestHoldDays: null,
      longestHoldPurchaseDate: null,
      longestHoldUsedUpAt: null
    };

    current.totalQty += record.quantity;
    if (record.itemStatus === "IN_USE" || record.itemStatus === "STORED") {
      current.activeQty += record.quantity;
      if (!current.oldestActivePurchaseDate || record.purchaseDate < current.oldestActivePurchaseDate) {
        current.oldestActivePurchaseDate = record.purchaseDate;
      }
    }

    if (record.usedUpAt) {
      const days = Math.max(0, differenceInCalendarDays(record.usedUpAt, record.purchaseDate));
      if (current.longestHoldDays == null || days > current.longestHoldDays) {
        current.longestHoldDays = days;
        current.longestHoldPurchaseDate = record.purchaseDate;
        current.longestHoldUsedUpAt = record.usedUpAt;
      }
    }

    grouped.set(key, current);
  }

  const values = [...grouped.values()];

  const longestHoldGroup = values
    .filter((item) => item.longestHoldDays != null)
    .sort((a, b) => (b.longestHoldDays ?? -1) - (a.longestHoldDays ?? -1))[0];

  const largestStockGroup = values
    .filter((item) => item.activeQty > 0)
    .sort((a, b) => b.activeQty - a.activeQty || a.name.localeCompare(b.name, "zh-Hans-CN"))[0];

  const favoritePurchaseGroup = values
    .filter((item) => item.totalQty > 0)
    .sort((a, b) => b.totalQty - a.totalQty || a.name.localeCompare(b.name, "zh-Hans-CN"))[0];

  const oldestCurrentStockGroup = values
    .filter((item) => item.activeQty > 0 && item.oldestActivePurchaseDate)
    .sort((a, b) => {
      const aDays = differenceInCalendarDays(now, a.oldestActivePurchaseDate!);
      const bDays = differenceInCalendarDays(now, b.oldestActivePurchaseDate!);
      return bDays - aDays || a.name.localeCompare(b.name, "zh-Hans-CN");
    })[0];

  return {
    longestHold: longestHoldGroup
      ? {
        name: longestHoldGroup.name,
        days: longestHoldGroup.longestHoldDays,
        purchaseDate: longestHoldGroup.longestHoldPurchaseDate,
        usedUpAt: longestHoldGroup.longestHoldUsedUpAt
      }
      : { name: null, days: null, purchaseDate: null, usedUpAt: null },
    largestStock: largestStockGroup
      ? {
        name: largestStockGroup.name,
        quantity: largestStockGroup.activeQty,
        purchaseDate: largestStockGroup.oldestActivePurchaseDate
      }
      : { name: null, quantity: null, purchaseDate: null },
    favoritePurchase: favoritePurchaseGroup
      ? {
        name: favoritePurchaseGroup.name,
        quantity: favoritePurchaseGroup.totalQty
      }
      : { name: null, quantity: null },
    oldestCurrentStock: oldestCurrentStockGroup
      ? {
        name: oldestCurrentStockGroup.name,
        quantity: oldestCurrentStockGroup.activeQty,
        days: differenceInCalendarDays(now, oldestCurrentStockGroup.oldestActivePurchaseDate!),
        purchaseDate: oldestCurrentStockGroup.oldestActivePurchaseDate
      }
      : { name: null, days: null, quantity: null, purchaseDate: null }
  };
}
