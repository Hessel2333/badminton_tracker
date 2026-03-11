import { PrismaClient } from "@prisma/client";

import { canonicalProductName } from "@/lib/business-rules";

const prisma = new PrismaClient();

async function main() {
  const [gearItems, purchaseRecords, wishlistItems] = await Promise.all([
    prisma.gearItem.findMany({
      include: {
        brand: { select: { name: true } },
        category: { select: { name: true } }
      }
    }),
    prisma.purchaseRecord.findMany({
      include: {
        brand: { select: { name: true } },
        category: { select: { name: true } },
        gearItem: { select: { modelCode: true } }
      }
    }),
    prisma.wishlistItem.findMany({
      include: {
        brand: { select: { name: true } },
        category: { select: { name: true } }
      }
    })
  ]);

  let updatedGearItems = 0;
  let updatedPurchaseRecords = 0;
  let updatedWishlistItems = 0;

  for (const item of gearItems) {
    const canonicalName = canonicalProductName({
      name: item.name,
      brandName: item.brand?.name ?? "",
      modelCode: item.modelCode ?? "",
      categoryName: item.category?.name ?? ""
    });

    if (item.name === canonicalName) continue;

    await prisma.gearItem.update({
      where: { id: item.id },
      data: { name: canonicalName }
    });
    updatedGearItems += 1;
  }

  for (const record of purchaseRecords) {
    const canonicalName = canonicalProductName({
      name: record.itemNameSnapshot,
      brandName: record.brand?.name ?? "",
      modelCode: record.gearItem?.modelCode ?? "",
      categoryName: record.category?.name ?? ""
    });

    if (record.itemNameSnapshot === canonicalName) continue;

    await prisma.purchaseRecord.update({
      where: { id: record.id },
      data: { itemNameSnapshot: canonicalName }
    });
    updatedPurchaseRecords += 1;
  }

  for (const item of wishlistItems) {
    const canonicalName = canonicalProductName({
      name: item.name,
      brandName: item.brand?.name ?? "",
      categoryName: item.category?.name ?? ""
    });

    if (item.name === canonicalName) continue;

    await prisma.wishlistItem.update({
      where: { id: item.id },
      data: { name: canonicalName }
    });
    updatedWishlistItems += 1;
  }

  console.log(
    JSON.stringify(
      {
        totalGearItems: gearItems.length,
        totalPurchaseRecords: purchaseRecords.length,
        totalWishlistItems: wishlistItems.length,
        updatedGearItems,
        updatedPurchaseRecords,
        updatedWishlistItems
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
