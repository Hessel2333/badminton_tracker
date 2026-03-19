import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/prisma";
import { buildProjectCatalogEntries } from "@/lib/project-catalog";

export const CATEGORIES_TAG = "categories";
export const PROJECT_CATALOG_TAG = "project-catalog";
export const BRANDS_TAG = "brands";
export const RATING_DIMENSIONS_TAG = "rating-dimensions";

export const compareProjectCatalogItems = (
  a: { categoryName: string; brandName: string; suggestedUnitPriceCny?: number; modelCode?: string; name: string },
  b: { categoryName: string; brandName: string; suggestedUnitPriceCny?: number; modelCode?: string; name: string }
) => {
  const collator = new Intl.Collator("zh-Hans-CN");
  const categoryDiff = collator.compare(a.categoryName, b.categoryName);
  if (categoryDiff !== 0) return categoryDiff;

  const brandDiff = collator.compare(a.brandName, b.brandName);
  if (brandDiff !== 0) return brandDiff;

  const aPrice = typeof a.suggestedUnitPriceCny === "number" ? a.suggestedUnitPriceCny : Number.POSITIVE_INFINITY;
  const bPrice = typeof b.suggestedUnitPriceCny === "number" ? b.suggestedUnitPriceCny : Number.POSITIVE_INFINITY;
  if (aPrice !== bPrice) return aPrice - bPrice;

  const modelDiff = collator.compare(a.modelCode ?? "", b.modelCode ?? "");
  if (modelDiff !== 0) return modelDiff;

  return collator.compare(a.name, b.name);
};

export const getCachedCategories = unstable_cache(
  async () =>
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
  ["categories"],
  {
    tags: [CATEGORIES_TAG]
  }
);

export const getCachedProjectCatalogEntries = unstable_cache(
  async () => {
    const overrides = await prisma.projectCatalogOverride.findMany({
      orderBy: [{ updatedAt: "desc" }]
    });

    return buildProjectCatalogEntries(overrides).sort(compareProjectCatalogItems);
  },
  ["project-catalog-entries"],
  {
    tags: [PROJECT_CATALOG_TAG]
  }
);

export const getCachedBrands = unstable_cache(
  async () =>
    prisma.brand.findMany({
      orderBy: { name: "asc" }
    }),
  ["brands"],
  {
    tags: [BRANDS_TAG],
    revalidate: 60
  }
);

export const getCachedRatingDimensions = unstable_cache(
  async () =>
    prisma.ratingDimension.findMany({
      orderBy: { sortOrder: "asc" }
    }),
  ["rating-dimensions"],
  {
    tags: [RATING_DIMENSIONS_TAG],
    revalidate: 60
  }
);
