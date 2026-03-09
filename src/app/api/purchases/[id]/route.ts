import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { calcTotalPrice } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { resolveOrCreateGearItemIdFromPurchase } from "@/lib/server/gear-from-purchase";
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
    const item = await prisma.$transaction(async (tx) => {
      const brandId = await findOrCreateBrandId(input.brandName ?? null, tx);
      const gearItemId = await resolveOrCreateGearItemIdFromPurchase(tx, {
        itemNameSnapshot: input.itemNameSnapshot,
        brandId,
        modelCode: input.modelCode ?? null,
        categoryId: input.categoryId ?? null,
        gearItemId: input.gearItemId ?? null
      });
      const totalPrice = calcTotalPrice(input.unitPriceCny, input.quantity, input.totalPriceCny ?? undefined);

      return tx.purchaseRecord.update({
        where: { id },
        data: {
          gearItemId,
          brandId,
          categoryId: input.categoryId ?? null,
          itemNameSnapshot: input.itemNameSnapshot,
          unitPriceCny: new Prisma.Decimal(input.unitPriceCny),
          quantity: input.quantity,
          totalPriceCny: new Prisma.Decimal(totalPrice),
          purchaseDate: new Date(input.purchaseDate),
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
    });

    return NextResponse.json(item);
  } catch (error) {
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
