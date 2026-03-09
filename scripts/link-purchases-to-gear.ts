import { PrismaClient } from "@prisma/client";

import { resolveOrCreateGearItemIdFromPurchase } from "@/lib/server/gear-from-purchase";

const prisma = new PrismaClient();

async function main() {
  const purchases = await prisma.purchaseRecord.findMany({
    select: {
      id: true,
      gearItemId: true,
      itemNameSnapshot: true,
      brandId: true,
      categoryId: true
    },
    orderBy: { createdAt: "asc" }
  });

  let linked = 0;

  for (const purchase of purchases) {
    const gearItemId = await prisma.$transaction(async (tx) => {
      return resolveOrCreateGearItemIdFromPurchase(tx, {
        gearItemId: purchase.gearItemId,
        itemNameSnapshot: purchase.itemNameSnapshot,
        brandId: purchase.brandId,
        categoryId: purchase.categoryId
      });
    });

    if (!gearItemId || gearItemId === purchase.gearItemId) continue;

    await prisma.purchaseRecord.update({
      where: { id: purchase.id },
      data: { gearItemId }
    });
    linked += 1;
  }

  console.log(`Linked ${linked}/${purchases.length} purchase records to gear items.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

