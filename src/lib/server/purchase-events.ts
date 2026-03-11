import { ItemStatus, Prisma, PurchaseEventType } from "@prisma/client";

type DbClient = Prisma.TransactionClient;

type CreatePurchaseEventInput = {
  purchaseRecordId?: string | null;
  gearItemId?: string | null;
  eventType: PurchaseEventType;
  quantityDelta?: number;
  fromStatus?: ItemStatus | null;
  toStatus?: ItemStatus | null;
  eventAt?: Date;
  notes?: string | null;
};

export async function createPurchaseEvent(
  db: DbClient,
  input: CreatePurchaseEventInput
) {
  return db.purchaseEvent.create({
    data: {
      purchaseRecordId: input.purchaseRecordId ?? null,
      gearItemId: input.gearItemId ?? null,
      eventType: input.eventType,
      quantityDelta: input.quantityDelta ?? 0,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      eventAt: input.eventAt ?? new Date(),
      notes: input.notes ?? null
    }
  });
}
