import { NextRequest, NextResponse } from "next/server";
import { Prisma, WishlistStatus } from "@prisma/client";

import { calcTotalPrice } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { resolveOrCreateGearItemIdFromPurchase } from "@/lib/server/gear-from-purchase";
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

    const gearItemId = await resolveOrCreateGearItemIdFromPurchase(tx, {
      itemNameSnapshot: wishlist.name,
      brandId: wishlist.brandId,
      categoryId: wishlist.categoryId
    });

    const purchase = await tx.purchaseRecord.create({
      data: {
        gearItemId,
        brandId: wishlist.brandId,
        categoryId: wishlist.categoryId,
        itemNameSnapshot: wishlist.name,
        unitPriceCny: new Prisma.Decimal(input.unitPriceCny),
        quantity: input.quantity,
        totalPriceCny: new Prisma.Decimal(total),
        purchaseDate: new Date(input.purchaseDate),
        channel: input.channel ?? null,
        isSecondHand: input.isSecondHand ?? false,
        notes: input.notes ?? wishlist.notes,
        receiptImageUrl: wishlist.imageUrl
      }
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
