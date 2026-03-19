import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";
import {
  getCachedBrands,
  getCachedCategories,
  getCachedProjectCatalogEntries,
  getCachedRatingDimensions
} from "@/lib/server/reference-data";

const PURCHASE_PAGE_SIZE = 80;
const PROJECT_LIBRARY_LIMIT = 240;

export async function getPurchasePageData() {
  const [purchases, categories, wishlistItems, projectCatalogEntries] = await Promise.all([
    prisma.purchaseRecord.findMany({
      select: {
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
            name: true
          }
        }
      },
      orderBy: { purchaseDate: "desc" },
      take: PURCHASE_PAGE_SIZE
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.wishlistItem.findMany({
      include: {
        brand: true,
        category: true
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
    }),
    getCachedProjectCatalogEntries()
  ]);

  const categoryByName = new Map(categories.map((item) => [item.name, item.id]));
  const fallbackCatalogItems = projectCatalogEntries
    .slice(0, PROJECT_LIBRARY_LIMIT)
    .map((item) => ({
      id: `project:${item.entryKey}`,
      source: "PROJECT" as const,
      name: item.name,
      brandName: item.brandName,
      modelCode: item.modelCode ?? "",
      categoryId: categoryByName.get(item.categoryName) ?? "",
      categoryName: item.categoryName,
      suggestedUnitPriceCny: item.suggestedUnitPriceCny ?? null,
      imageUrl: item.imageUrl ?? null,
      hotRank: item.popularity,
      historyCount: 0,
      lastPurchasedAt: null,
      tags: item.tags ?? []
    }));

  return {
    fallbackPurchases: purchases.map((item) => ({
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
    })),
    fallbackCategories: categories,
    fallbackCatalogItems,
    fallbackWishlist: wishlistItems.map((item) => ({
      ...item,
      targetPriceCny: item.targetPriceCny == null ? null : toNumber(item.targetPriceCny),
      currentSeenPriceCny: item.currentSeenPriceCny == null ? null : toNumber(item.currentSeenPriceCny)
    }))
  };
}

export async function getWishlistPageData() {
  const [fallbackWishlist, fallbackCategories] = await Promise.all([
    prisma.wishlistItem.findMany({
      include: {
        brand: true,
        category: true
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }]
    }),
    getCachedCategories()
  ]);

  return {
    fallbackWishlist: fallbackWishlist.map((item) => ({
      ...item,
      targetPriceCny: item.targetPriceCny == null ? null : toNumber(item.targetPriceCny),
      currentSeenPriceCny: item.currentSeenPriceCny == null ? null : toNumber(item.currentSeenPriceCny)
    })),
    fallbackCategories
  };
}

export async function getSettingsPageData() {
  const [fallbackCategories, fallbackBrands, fallbackDimensions, fallbackProjectCatalog] = await Promise.all([
    getCachedCategories(),
    getCachedBrands(),
    getCachedRatingDimensions(),
    getCachedProjectCatalogEntries()
  ]);

  return {
    fallbackCategories,
    fallbackBrands,
    fallbackDimensions: fallbackDimensions.map((item) => ({
      ...item,
      weight: toNumber(item.weight)
    })),
    fallbackProjectCatalog
  };
}
