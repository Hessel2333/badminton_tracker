import { ItemStatus, PurchaseEventType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const purchases = await prisma.purchaseRecord.findMany({
    include: {
      events: {
        select: {
          eventType: true
        }
      }
    }
  });

  let createdCount = 0;

  for (const purchase of purchases) {
    const existingTypes = new Set(purchase.events.map((event) => event.eventType));
    const eventsToCreate: Array<{
      purchaseRecordId: string;
      gearItemId: string | null;
      eventType: PurchaseEventType;
      quantityDelta: number;
      fromStatus: ItemStatus | null;
      toStatus: ItemStatus | null;
      eventAt: Date;
      notes: string | null;
    }> = [];

    if (!existingTypes.has(PurchaseEventType.PURCHASED)) {
      eventsToCreate.push({
        purchaseRecordId: purchase.id,
        gearItemId: purchase.gearItemId,
        eventType: PurchaseEventType.PURCHASED,
        quantityDelta: purchase.quantity,
        fromStatus: null,
        toStatus: purchase.itemStatus,
        eventAt: purchase.purchaseDate,
        notes: null
      });
    }

    if (purchase.itemStatus === ItemStatus.USED_UP && !existingTypes.has(PurchaseEventType.CONSUMED)) {
      eventsToCreate.push({
        purchaseRecordId: purchase.id,
        gearItemId: purchase.gearItemId,
        eventType: PurchaseEventType.CONSUMED,
        quantityDelta: -purchase.quantity,
        fromStatus: ItemStatus.IN_USE,
        toStatus: ItemStatus.USED_UP,
        eventAt: purchase.usedUpAt ?? purchase.createdAt,
        notes: "历史数据回填"
      });
    }

    if (purchase.itemStatus === ItemStatus.WORN_OUT && !existingTypes.has(PurchaseEventType.DAMAGED)) {
      eventsToCreate.push({
        purchaseRecordId: purchase.id,
        gearItemId: purchase.gearItemId,
        eventType: PurchaseEventType.DAMAGED,
        quantityDelta: -purchase.quantity,
        fromStatus: ItemStatus.IN_USE,
        toStatus: ItemStatus.WORN_OUT,
        eventAt: purchase.createdAt,
        notes: "历史数据回填"
      });
    }

    if (!eventsToCreate.length) continue;

    await prisma.purchaseEvent.createMany({
      data: eventsToCreate
    });
    createdCount += eventsToCreate.length;
  }

  console.log(JSON.stringify({ purchases: purchases.length, createdEvents: createdCount }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
