import {
  getCachedDefaultPurchaseRecords,
  getCachedWishlistRecords,
  serializePurchaseRow,
  serializeWishlistItem
} from "@/lib/server/commerce-data";
import { toNumber } from "@/lib/server/number";
import {
  getCachedBrands,
  getCachedCategories,
  getCachedProjectCatalogEntries,
  getCachedRatingDimensions
} from "@/lib/server/reference-data";

const PROJECT_LIBRARY_LIMIT = 240;

export async function getPurchasePageData() {
  const [purchases, categories, wishlistItems, projectCatalogEntries] = await Promise.all([
    getCachedDefaultPurchaseRecords(),
    getCachedCategories(),
    getCachedWishlistRecords(),
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
    fallbackPurchases: purchases.map(serializePurchaseRow),
    fallbackCategories: categories,
    fallbackCatalogItems,
    fallbackWishlist: wishlistItems.map(serializeWishlistItem)
  };
}

export async function getWishlistPageData() {
  const [fallbackWishlist, fallbackCategories] = await Promise.all([
    getCachedWishlistRecords(),
    getCachedCategories()
  ]);

  return {
    fallbackWishlist: fallbackWishlist.map(serializeWishlistItem),
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
