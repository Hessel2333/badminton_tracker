import { PrismaClient } from "@prisma/client";

import { canonicalBrandDisplayName, normalizeBrandGroupName } from "@/lib/business-rules";

const prisma = new PrismaClient();

async function main() {
  const brands = await prisma.brand.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }]
  });

  const groups = new Map<string, typeof brands>();
  for (const brand of brands) {
    const key = normalizeBrandGroupName(brand.name);
    const current = groups.get(key) ?? [];
    current.push(brand);
    groups.set(key, current);
  }

  let mergedGroups = 0;
  let removedBrands = 0;

  for (const [groupKey, items] of groups.entries()) {
    if (!groupKey) continue;
    const canonicalName = canonicalBrandDisplayName(items[0].name);
    const primary =
      items.find((item) => item.normalizedName === groupKey) ??
      items[0];

    await prisma.$transaction(async (tx) => {
      await tx.brand.update({
        where: { id: primary.id },
        data: {
          name: canonicalName,
          normalizedName: groupKey
        }
      });

      const duplicates = items.filter((item) => item.id !== primary.id);
      if (!duplicates.length) return;

      const duplicateIds = duplicates.map((item) => item.id);
      await tx.gearItem.updateMany({
        where: { brandId: { in: duplicateIds } },
        data: { brandId: primary.id }
      });
      await tx.purchaseRecord.updateMany({
        where: { brandId: { in: duplicateIds } },
        data: { brandId: primary.id }
      });
      await tx.wishlistItem.updateMany({
        where: { brandId: { in: duplicateIds } },
        data: { brandId: primary.id }
      });
      await tx.brand.deleteMany({
        where: { id: { in: duplicateIds } }
      });

      mergedGroups += 1;
      removedBrands += duplicates.length;
    });
  }

  console.log(JSON.stringify({ totalBrands: brands.length, mergedGroups, removedBrands }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
