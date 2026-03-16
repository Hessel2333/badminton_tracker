import { NextRequest, NextResponse } from "next/server";
import { Prisma, WishlistStatus } from "@prisma/client";

import { calcTotalPrice, canonicalProductName } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { resolveOrCreateGearItemIdFromPurchase } from "@/lib/server/gear-from-purchase";
import { createPurchaseEvent } from "@/lib/server/purchase-events";
import { wishlistConvertSchema } from "@/lib/validators/wishlist";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = wishlistConvertSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const wishlist = await tx.wishlistItem.findUnique({ where: { id } });
    if (!wishlist) {
      throw new Error("Wishlist item not found");
    }

    const total = calcTotalPrice(input.unitPriceCny, input.quantity, input.totalPriceCny ?? undefined);
    const nextCategoryId = input.categoryId ?? wishlist.categoryId;
    const nextBrandName = input.brandName?.trim() || null;
    const brandId = nextBrandName
      ? await findOrCreateBrandId(nextBrandName, tx)
      : wishlist.brandId;
    const nextModelCode = input.modelCode?.trim() || null;
    const canonicalName = canonicalProductName({
      name: input.itemNameSnapshot?.trim() || wishlist.name,
      brandName: nextBrandName ?? "",
      modelCode: nextModelCode ?? "",
      categoryName: (
        nextCategoryId
          ? await tx.category.findUnique({
              where: { id: nextCategoryId },
              select: { name: true }
            })
          : null
      )?.name ?? ""
    });

    const gearItemId = await resolveOrCreateGearItemIdFromPurchase(tx, {
      itemNameSnapshot: canonicalName,
      brandName: nextBrandName,
      brandId,
      modelCode: nextModelCode,
      categoryId: nextCategoryId,
      allowAutoImageLookup: !input.gearCoverImageUrl,
      coverImageUrl: input.gearCoverImageUrl ?? wishlist.imageUrl
    });

    const purchase = await tx.purchaseRecord.create({
      data: {
        gearItemId,
        brandId,
        categoryId: nextCategoryId,
        itemNameSnapshot: canonicalName,
        unitPriceCny: new Prisma.Decimal(input.unitPriceCny),
        quantity: input.quantity,
        totalPriceCny: new Prisma.Decimal(total),
        purchaseDate: new Date(input.purchaseDate),
        channel: input.channel ?? null,
        itemStatus: input.itemStatus,
        isSecondHand: input.isSecondHand ?? false,
        notes: input.notes ?? wishlist.notes,
        receiptImageUrl: wishlist.imageUrl
      }
    });
    await createPurchaseEvent(tx, {
      purchaseRecordId: purchase.id,
      gearItemId: purchase.gearItemId,
      eventType: "PURCHASED",
      quantityDelta: purchase.quantity,
      toStatus: purchase.itemStatus,
      eventAt: purchase.purchaseDate
    });

    const previousStatus = wishlist.status;

    const updatedWishlist = await tx.wishlistItem.update({
      where: { id: wishlist.id },
      data: { status: WishlistStatus.PURCHASED }
    });

    const transition = await tx.wishlistTransition.create({
      data: {
        wishlistItemId: wishlist.id,
        fromStatus: previousStatus,
        toStatus: WishlistStatus.PURCHASED,
        linkedPurchaseId: purchase.id
      }
    });

    return {
      wishlist: updatedWishlist,
      purchase,
      transition
    };
  });

  return NextResponse.json(result, { status: 201 });
}
