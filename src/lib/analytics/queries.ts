import { Prisma } from "@prisma/client";
import { subMonths } from "date-fns";

import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";

function monthsFromRange(range = "12m") {
  const numeric = Number(range.replace("m", ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 12;
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

export async function getSpendingTrend(range = "12m") {
  const months = monthsFromRange(range);
  const from = subMonths(new Date(), months - 1);

  const rows = await prisma.$queryRaw<
    Array<{ bucket: Date; amount: Prisma.Decimal | number | string }>
  >`
    SELECT
      date_trunc('month', purchase_date) AS bucket,
      SUM(total_price_cny) AS amount
    FROM purchase_records
    WHERE purchase_date >= ${from}
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  return rows.map((row) => ({
    bucket: row.bucket,
    amount: toNumber(row.amount)
  }));
}

export async function getBrandShare(range = "12m") {
  const months = monthsFromRange(range);
  const from = subMonths(new Date(), months - 1);

  const grouped = await prisma.purchaseRecord.groupBy({
    by: ["brandId"],
    where: {
      purchaseDate: { gte: from }
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

export async function getCategoryShare(range = "12m") {
  const months = monthsFromRange(range);
  const from = subMonths(new Date(), months - 1);

  const grouped = await prisma.purchaseRecord.groupBy({
    by: ["categoryId"],
    where: {
      purchaseDate: { gte: from }
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

export async function getPurchaseFrequency(granularity: "week" | "month", range = "12m") {
  const trunc = granularity === "week" ? "week" : "month";
  const months = monthsFromRange(range);
  const from = subMonths(new Date(), months - 1);

  const rows = await prisma.$queryRawUnsafe<Array<{ bucket: Date; count: bigint | number }>>(
    `
      SELECT
        date_trunc('${trunc}', purchase_date) AS bucket,
        COUNT(*) AS count
      FROM purchase_records
      WHERE purchase_date >= $1
      GROUP BY 1
      ORDER BY 1 ASC
    `,
    from
  );

  return rows.map((row) => ({
    bucket: row.bucket,
    count: typeof row.count === "bigint" ? Number(row.count) : Number(row.count)
  }));
}
