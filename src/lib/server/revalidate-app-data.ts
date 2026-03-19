import { revalidateTag } from "next/cache";

import { prisma } from "@/lib/prisma";
import { ANALYTICS_FULL_TAG } from "@/lib/server/analytics-data";
import { ARCHIVE_ITEMS_TAG } from "@/lib/server/archive-items";
import { PURCHASES_TAG, WISHLIST_TAG } from "@/lib/server/commerce-data";
import { DASHBOARD_DATA_TAG } from "@/lib/server/dashboard-data";
import {
  BRANDS_TAG,
  CATEGORIES_TAG,
  PROJECT_CATALOG_TAG,
  RATING_DIMENSIONS_TAG
} from "@/lib/server/reference-data";

export async function invalidateAnalyticsSnapshots() {
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM analytics_snapshots`);
  } catch (error) {
    console.warn("[perf] invalidate analytics snapshots skipped", error);
  }
  revalidateTag(ANALYTICS_FULL_TAG);
}

export async function revalidatePurchaseDerivedData() {
  revalidateTag(PURCHASES_TAG);
  revalidateTag(DASHBOARD_DATA_TAG);
  revalidateTag(ARCHIVE_ITEMS_TAG);
  await invalidateAnalyticsSnapshots();
}

export async function revalidateWishlistDerivedData() {
  revalidateTag(WISHLIST_TAG);
  revalidateTag(DASHBOARD_DATA_TAG);
  await invalidateAnalyticsSnapshots();
}

export async function revalidateGearDerivedData() {
  revalidateTag(PURCHASES_TAG);
  revalidateTag(ARCHIVE_ITEMS_TAG);
  revalidateTag(DASHBOARD_DATA_TAG);
  await invalidateAnalyticsSnapshots();
}

export function revalidateReferenceData() {
  revalidateTag(CATEGORIES_TAG);
  revalidateTag(BRANDS_TAG);
  revalidateTag(RATING_DIMENSIONS_TAG);
  revalidateTag(PROJECT_CATALOG_TAG);
}

export async function revalidateAllCoreData() {
  revalidateReferenceData();
  revalidateTag(PURCHASES_TAG);
  revalidateTag(WISHLIST_TAG);
  revalidateTag(ARCHIVE_ITEMS_TAG);
  revalidateTag(DASHBOARD_DATA_TAG);
  await invalidateAnalyticsSnapshots();
}
