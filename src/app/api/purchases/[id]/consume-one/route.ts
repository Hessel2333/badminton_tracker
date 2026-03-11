import { NextRequest, NextResponse } from "next/server";
import { ItemStatus, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { createPurchaseEvent } from "@/lib/server/purchase-events";

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const source = await tx.purchaseRecord.findUnique({
        where: { id }
      });

      if (!source) {
        throw new Error("NOT_FOUND");
      }

      if (source.quantity <= 0) {
        throw new Error("INVALID_QUANTITY");
      }

      if (!(source.itemStatus === ItemStatus.IN_USE || source.itemStatus === ItemStatus.STORED)) {
        throw new Error("INVALID_STATUS");
      }

      if (source.quantity === 1) {
        const updated = await tx.purchaseRecord.update({
          where: { id: source.id },
          data: {
            itemStatus: ItemStatus.USED_UP,
            usedUpAt: new Date()
          }
        });

        await createPurchaseEvent(tx, {
          purchaseRecordId: updated.id,
          gearItemId: updated.gearItemId,
          eventType: "CONSUMED",
          quantityDelta: -1,
          fromStatus: source.itemStatus,
          toStatus: ItemStatus.USED_UP,
          eventAt: updated.usedUpAt ?? new Date()
        });

        return { mode: "status_only", updated };
      }

      const remainingQuantity = source.quantity - 1;
      const remainingTotal = source.unitPriceCny.mul(new Prisma.Decimal(remainingQuantity));

      const updated = await tx.purchaseRecord.update({
        where: { id: source.id },
        data: {
          quantity: remainingQuantity,
          totalPriceCny: remainingTotal
        }
      });

      const consumed = await tx.purchaseRecord.create({
        data: {
          gearItemId: source.gearItemId,
          brandId: source.brandId,
          categoryId: source.categoryId,
          itemNameSnapshot: source.itemNameSnapshot,
          unitPriceCny: source.unitPriceCny,
          quantity: 1,
          totalPriceCny: source.unitPriceCny,
          purchaseDate: source.purchaseDate,
          usedUpAt: new Date(),
          channel: source.channel,
          itemStatus: ItemStatus.USED_UP,
          isSecondHand: source.isSecondHand,
          notes: source.notes,
          receiptImageUrl: source.receiptImageUrl
        }
      });

      await createPurchaseEvent(tx, {
        purchaseRecordId: consumed.id,
        gearItemId: consumed.gearItemId,
        eventType: "CONSUMED",
        quantityDelta: -1,
        fromStatus: source.itemStatus,
        toStatus: ItemStatus.USED_UP,
        eventAt: consumed.usedUpAt ?? new Date()
      });

      return { mode: "split", updated, consumed };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = (error as Error).message;
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }
    if (message === "INVALID_QUANTITY") {
      return NextResponse.json({ error: "数量无效，无法执行用完 1" }, { status: 400 });
    }
    if (message === "INVALID_STATUS") {
      return NextResponse.json({ error: "当前状态不支持执行用完 1" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "执行用完 1 失败", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
