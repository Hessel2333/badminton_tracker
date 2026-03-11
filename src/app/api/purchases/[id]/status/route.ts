import { NextRequest, NextResponse } from "next/server";
import { PurchaseEventType } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { createPurchaseEvent } from "@/lib/server/purchase-events";

const statusSchema = z.object({
  itemStatus: z.enum(["IN_USE", "USED_UP", "WORN_OUT", "STORED"])
});

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseRecord.findUnique({
        where: { id },
        select: {
          id: true,
          gearItemId: true,
          quantity: true,
          itemStatus: true
        }
      });

      if (!existing) {
        throw new Error("NOT_FOUND");
      }

      const nextStatus = parsed.data.itemStatus;
      const nextUsedUpAt = nextStatus === "USED_UP" ? new Date() : null;
      const updatedRecord = await tx.purchaseRecord.update({
        where: { id },
        data: {
          itemStatus: nextStatus,
          usedUpAt: nextUsedUpAt
        }
      });

      if (existing.itemStatus !== nextStatus) {
        const eventType =
          nextStatus === "USED_UP"
            ? PurchaseEventType.CONSUMED
            : nextStatus === "WORN_OUT"
              ? PurchaseEventType.DAMAGED
              : PurchaseEventType.STATUS_CHANGED;

        await createPurchaseEvent(tx, {
          purchaseRecordId: existing.id,
          gearItemId: existing.gearItemId,
          eventType,
          quantityDelta:
            eventType === PurchaseEventType.CONSUMED || eventType === PurchaseEventType.DAMAGED
              ? -existing.quantity
              : 0,
          fromStatus: existing.itemStatus,
          toStatus: nextStatus,
          eventAt: nextUsedUpAt ?? new Date()
        });
      }

      return updatedRecord;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if ((error as Error).message === "NOT_FOUND") {
      return NextResponse.json({ error: "记录不存在" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "状态更新失败", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
