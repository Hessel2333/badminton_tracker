import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { calcTotalPrice, canonicalProductName } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { resolveOrCreateGearItemIdFromPurchase } from "@/lib/server/gear-from-purchase";
import { createPurchaseEvent } from "@/lib/server/purchase-events";
import { purchaseSchema } from "@/lib/validators/purchase";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const canonicalItemName = canonicalProductName({
      name: input.itemNameSnapshot,
      brandName: input.brandName ?? undefined,
      modelCode: input.modelCode ?? undefined
    });
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseRecord.findUnique({
        where: { id },
        select: { usedUpAt: true, itemStatus: true, gearItemId: true }
      });
      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const brandId = await findOrCreateBrandId(input.brandName ?? null, tx);
      const gearItemId = await resolveOrCreateGearItemIdFromPurchase(tx, {
        itemNameSnapshot: canonicalItemName,
        brandName: input.brandName ?? null,
        brandId,
        modelCode: input.modelCode ?? null,
        categoryId: input.categoryId ?? null,
        gearItemId: input.gearItemId ?? null,
        allowAutoImageLookup: input.allowAutoImageLookup,
        coverImageUrl: input.gearCoverImageUrl ?? null
      });
      const totalPrice = calcTotalPrice(input.unitPriceCny, input.quantity, input.totalPriceCny ?? undefined);

      const updated = await tx.purchaseRecord.update({
        where: { id },
        data: {
          gearItemId,
          brandId,
          categoryId: input.categoryId ?? null,
          itemNameSnapshot: canonicalItemName,
          unitPriceCny: new Prisma.Decimal(input.unitPriceCny),
          quantity: input.quantity,
          totalPriceCny: new Prisma.Decimal(totalPrice),
          purchaseDate: new Date(input.purchaseDate),
          usedUpAt:
            input.itemStatus === "USED_UP"
              ? existing.usedUpAt ?? new Date()
              : null,
          channel: input.channel ?? null,
          itemStatus: input.itemStatus,
          isSecondHand: input.isSecondHand ?? false,
          notes: input.notes ?? null,
          receiptImageUrl: input.receiptImageUrl ?? null
        },
        include: {
          brand: true,
          category: true,
          gearItem: true
        }
      });

      if (existing.itemStatus !== input.itemStatus) {
        await createPurchaseEvent(tx, {
          purchaseRecordId: updated.id,
          gearItemId: updated.gearItemId ?? existing.gearItemId,
          eventType:
            input.itemStatus === "USED_UP"
              ? "CONSUMED"
              : input.itemStatus === "WORN_OUT"
                ? "DAMAGED"
                : "STATUS_CHANGED",
          quantityDelta: input.itemStatus === "USED_UP" || input.itemStatus === "WORN_OUT" ? -updated.quantity : 0,
          fromStatus: existing.itemStatus,
          toStatus: input.itemStatus,
          eventAt: input.itemStatus === "USED_UP" ? (updated.usedUpAt ?? new Date()) : new Date()
        });
      }

      return updated;
    });

    return NextResponse.json(item);
  } catch (error) {
    if ((error as Error).message === "NOT_FOUND") {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to update purchase record", detail: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const { id } = await context.params;
    await prisma.purchaseRecord.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete purchase record", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
