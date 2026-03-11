import { PrismaClient } from "@prisma/client";

import { canonicalProductKey, canonicalProductName } from "@/lib/business-rules";

const prisma = new PrismaClient();

async function main() {
  const gearItems = await prisma.gearItem.findMany({
    include: {
      brand: { select: { name: true } },
      category: { select: { name: true } },
      purchases: { select: { id: true } },
      ratings: { select: { id: true } },
      externalViews: { select: { id: true } },
      events: { select: { id: true } }
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  const groups = new Map<string, typeof gearItems>();
  for (const item of gearItems) {
    const key = canonicalProductKey({
      name: item.name,
      brandName: item.brand?.name ?? undefined,
      modelCode: item.modelCode ?? undefined,
      categoryName: item.category?.name ?? undefined
    });
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  let mergedGroups = 0;
  let removedItems = 0;
  let touchedPurchases = 0;

  for (const items of groups.values()) {
    if (items.length <= 1) {
      const single = items[0];
      const canonicalName = canonicalProductName({
        name: single.name,
        brandName: single.brand?.name ?? undefined,
        modelCode: single.modelCode ?? undefined,
        categoryName: single.category?.name ?? undefined
      });
      if (single.name !== canonicalName) {
        await prisma.gearItem.update({
          where: { id: single.id },
          data: { name: canonicalName }
        });
        await prisma.purchaseRecord.updateMany({
          where: { gearItemId: single.id },
          data: { itemNameSnapshot: canonicalName }
        });
      }
      continue;
    }

    const primary = [...items].sort((a, b) => {
      const purchaseDiff = b.purchases.length - a.purchases.length;
      if (purchaseDiff !== 0) return purchaseDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })[0];
    const duplicates = items.filter((item) => item.id !== primary.id);
    const canonicalName = canonicalProductName({
      name: primary.name,
      brandName: primary.brand?.name ?? items.find((item) => item.brand?.name)?.brand?.name ?? undefined,
      modelCode: primary.modelCode ?? items.find((item) => item.modelCode)?.modelCode ?? undefined,
      categoryName: primary.category?.name ?? items.find((item) => item.category?.name)?.category?.name ?? undefined
    });

    const mergedBrandId = primary.brandId ?? duplicates.find((item) => item.brandId)?.brandId ?? null;
    const mergedCategoryId = primary.categoryId ?? duplicates.find((item) => item.categoryId)?.categoryId ?? null;
    const mergedModelCode = primary.modelCode ?? duplicates.find((item) => item.modelCode)?.modelCode ?? null;
    const mergedCoverImageUrl = primary.coverImageUrl ?? duplicates.find((item) => item.coverImageUrl)?.coverImageUrl ?? null;
    const mergedNotes = primary.notes ?? duplicates.find((item) => item.notes)?.notes ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.gearItem.update({
        where: { id: primary.id },
        data: {
          name: canonicalName,
          brandId: mergedBrandId,
          categoryId: mergedCategoryId,
          modelCode: mergedModelCode,
          coverImageUrl: mergedCoverImageUrl,
          notes: mergedNotes
        }
      });

      const duplicateIds = duplicates.map((item) => item.id);
      if (duplicateIds.length) {
        const purchaseUpdate = await tx.purchaseRecord.updateMany({
          where: { gearItemId: { in: duplicateIds } },
          data: {
            gearItemId: primary.id,
            brandId: mergedBrandId,
            categoryId: mergedCategoryId,
            itemNameSnapshot: canonicalName
          }
        });
        touchedPurchases += purchaseUpdate.count;

        await tx.purchaseRecord.updateMany({
          where: { gearItemId: primary.id },
          data: {
            brandId: mergedBrandId,
            categoryId: mergedCategoryId,
            itemNameSnapshot: canonicalName
          }
        });

        await tx.gearRating.updateMany({
          where: { gearItemId: { in: duplicateIds } },
          data: { gearItemId: primary.id }
        });
        await tx.externalReview.updateMany({
          where: { gearItemId: { in: duplicateIds } },
          data: { gearItemId: primary.id }
        });
        await tx.purchaseEvent.updateMany({
          where: { gearItemId: { in: duplicateIds } },
          data: { gearItemId: primary.id }
        });

        await tx.gearItem.deleteMany({
          where: { id: { in: duplicateIds } }
        });
      }
    });

    mergedGroups += 1;
    removedItems += duplicates.length;
  }

  console.log(
    JSON.stringify(
      {
        totalGearItems: gearItems.length,
        mergedGroups,
        removedItems,
        touchedPurchases
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
