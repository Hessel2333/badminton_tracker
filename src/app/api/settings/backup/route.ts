import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const [brands, categories, gear, purchases, wishlist, transitions] = await Promise.all([
    prisma.brand.findMany(),
    prisma.category.findMany(),
    prisma.gearItem.findMany(),
    prisma.purchaseRecord.findMany(),
    prisma.wishlistItem.findMany(),
    prisma.wishlistTransition.findMany()
  ]);

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    brands,
    categories,
    gear,
    purchases,
    wishlist,
    transitions
  });
}
