import { unstable_cache } from "next/cache";
import type { Prisma, WishlistStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";

export const PURCHASES_TAG = "purchases-data";
export const WISHLIST_TAG = "wishlist-data";
export const DEFAULT_PURCHASE_PAGE_SIZE = 80;

const purchaseListSelect = {
  id: true,
  brandId: true,
  categoryId: true,
  itemNameSnapshot: true,
  unitPriceCny: true,
  quantity: true,
  totalPriceCny: true,
  itemStatus: true,
  purchaseDate: true,
  channel: true,
  notes: true,
  brand: {
    select: {
      id: true,
      name: true
    }
  },
  gearItem: {
    select: {
      id: true,
      modelCode: true,
      coverImageUrl: true
    }
  },
  category: {
    select: {
      id: true,
      name: true
    }
  }
} satisfies Prisma.PurchaseRecordSelect;

type PurchaseListRecord = Prisma.PurchaseRecordGetPayload<{
  select: typeof purchaseListSelect;
}>;

type WishlistRecord = Prisma.WishlistItemGetPayload<{
  include: {
    brand: true;
    category: true;
  };
}>;

export function serializePurchaseRow(item: PurchaseListRecord) {
  return {
    id: item.id,
    brandId: item.brandId,
    categoryId: item.categoryId,
    itemNameSnapshot: item.itemNameSnapshot,
    gearItem: item.gearItem,
    brand: item.brand,
    category: item.category,
    unitPriceCny: toNumber(item.unitPriceCny),
    quantity: item.quantity,
    totalPriceCny: toNumber(item.totalPriceCny),
    itemStatus: item.itemStatus,
    purchaseDate: item.purchaseDate.toISOString(),
    channel: item.channel,
    notes: item.notes
  };
}

export function serializeWishlistItem(item: WishlistRecord) {
  return {
    ...item,
    targetPriceCny: item.targetPriceCny == null ? null : toNumber(item.targetPriceCny),
    currentSeenPriceCny: item.currentSeenPriceCny == null ? null : toNumber(item.currentSeenPriceCny)
  };
}

export async function queryDefaultPurchaseRecords(pageSize = DEFAULT_PURCHASE_PAGE_SIZE) {
  return prisma.purchaseRecord.findMany({
    select: purchaseListSelect,
    orderBy: { purchaseDate: "desc" },
    take: pageSize
  });
}

export const getCachedDefaultPurchaseRecords = unstable_cache(
  async () => queryDefaultPurchaseRecords(DEFAULT_PURCHASE_PAGE_SIZE),
  ["purchase-records-default"],
  {
    tags: [PURCHASES_TAG],
    revalidate: 60
  }
);

export const getCachedWishlistRecords = unstable_cache(
  async () =>
    prisma.wishlistItem.findMany({
      include: {
        brand: true,
        category: true
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
    }),
  ["wishlist-items-all"],
  {
    tags: [WISHLIST_TAG],
    revalidate: 60
  }
);

export async function getCachedWishlistRecordsByStatus(status?: WishlistStatus) {
  const items = await getCachedWishlistRecords();
  if (!status) return items;
  return items.filter((item) => item.status === status);
}
