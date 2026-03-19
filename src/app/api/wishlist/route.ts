import { NextRequest, NextResponse } from "next/server";
import { Prisma, WishlistStatus } from "@prisma/client";

import { canonicalProductName } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { getCachedWishlistRecordsByStatus, serializeWishlistItem } from "@/lib/server/commerce-data";
import { createRequestMetrics } from "@/lib/server/perf";
import { revalidateWishlistDerivedData } from "@/lib/server/revalidate-app-data";
import { wishlistSchema } from "@/lib/validators/wishlist";

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = wishlistSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const category = input.categoryId
    ? await prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { name: true }
      })
    : null;
  const canonicalName = canonicalProductName({
    name: input.name,
    brandName: input.brandName ?? "",
    categoryName: category?.name ?? ""
  });
  const brandId = await findOrCreateBrandId(input.brandName ?? null);

  const item = await prisma.wishlistItem.create({
    data: {
      name: canonicalName,
      brandId,
      categoryId: input.categoryId ?? null,
      targetPriceCny: input.targetPriceCny != null ? new Prisma.Decimal(input.targetPriceCny) : null,
      currentSeenPriceCny:
        input.currentSeenPriceCny != null ? new Prisma.Decimal(input.currentSeenPriceCny) : null,
      priority: input.priority,
      status: input.status,
      sourceUrl: input.sourceUrl ?? null,
      imageUrl: input.imageUrl ?? null,
      notes: input.notes ?? null
    },
    include: {
      brand: true,
      category: true
    }
  });

  await revalidateWishlistDerivedData();

  return NextResponse.json(item, { status: 201 });
}

export async function GET(request: NextRequest) {
  const metrics = createRequestMetrics("api.wishlist.get");
  const auth = await metrics.track("auth", () => requireSession());
  if ("error" in auth) return auth.error;

  const statusParam = request.nextUrl.searchParams.get("status");
  const status =
    statusParam && Object.values(WishlistStatus).includes(statusParam as WishlistStatus)
      ? (statusParam as WishlistStatus)
      : undefined;

  const items = await metrics.track("cache", () => getCachedWishlistRecordsByStatus(status));
  metrics.log({ status: status ?? "all" });

  return NextResponse.json(
    { items: items.map(serializeWishlistItem) },
    {
      headers: metrics.headers()
    }
  );
}
