import { ItemStatus, Prisma, PrismaClient } from "@prisma/client";

import { findLocalImageUrl } from "../src/lib/server/local-image-library";

const prisma = new PrismaClient();

type SeedItem = {
  name: string;
  brandName: string | null;
  categoryName: "球鞋" | "球拍" | "羽毛球";
  quantity: number;
  itemStatus: ItemStatus;
  purchaseDate: string;
  note?: string;
};

const DATA: SeedItem[] = [
  {
    name: "贴地飞行 2 MAX",
    brandName: "李宁",
    categoryName: "球鞋",
    quantity: 1,
    itemStatus: ItemStatus.IN_USE,
    purchaseDate: "2025-11-06T10:00:00.000Z",
    note: "首批导入；价格待补充"
  },
  {
    name: "P9200TTY",
    brandName: "VICTOR",
    categoryName: "球鞋",
    quantity: 1,
    itemStatus: ItemStatus.IN_USE,
    purchaseDate: "2025-09-18T10:00:00.000Z",
    note: "首批导入；价格待补充"
  },
  {
    name: "P8500NL",
    brandName: "VICTOR",
    categoryName: "球鞋",
    quantity: 1,
    itemStatus: ItemStatus.WORN_OUT,
    purchaseDate: "2025-05-14T10:00:00.000Z",
    note: "首批导入；已穿坏；价格待补充"
  },
  {
    name: "VICTOR 大铁锤",
    brandName: "VICTOR",
    categoryName: "球拍",
    quantity: 1,
    itemStatus: ItemStatus.IN_USE,
    purchaseDate: "2025-07-03T10:00:00.000Z",
    note: "首批导入；价格待补充"
  },
  {
    name: "亚狮龙1号",
    brandName: "亚狮龙",
    categoryName: "羽毛球",
    quantity: 2,
    itemStatus: ItemStatus.IN_USE,
    purchaseDate: "2026-01-12T10:00:00.000Z",
    note: "首批导入；两桶；价格待补充"
  },
  {
    name: "亚狮龙2号",
    brandName: "亚狮龙",
    categoryName: "羽毛球",
    quantity: 1,
    itemStatus: ItemStatus.IN_USE,
    purchaseDate: "2026-02-01T10:00:00.000Z",
    note: "首批导入；一桶；价格待补充"
  },
  {
    name: "亚狮龙7号",
    brandName: "亚狮龙",
    categoryName: "羽毛球",
    quantity: 2,
    itemStatus: ItemStatus.IN_USE,
    purchaseDate: "2026-02-20T10:00:00.000Z",
    note: "首批导入；两桶；价格待补充"
  },
  {
    name: "黄超羽毛球",
    brandName: null,
    categoryName: "羽毛球",
    quantity: 1,
    itemStatus: ItemStatus.IN_USE,
    purchaseDate: "2025-12-08T10:00:00.000Z",
    note: "首批导入；一桶；价格待补充"
  }
];

function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function findOrCreateBrandId(brandName: string | null): Promise<string | null> {
  if (!brandName) return null;
  const normalized = normalizeBrandName(brandName);

  const brand = await prisma.brand.upsert({
    where: { normalizedName: normalized },
    update: { name: brandName },
    create: {
      name: brandName,
      normalizedName: normalized
    }
  });

  return brand.id;
}

async function findCategoryId(categoryName: SeedItem["categoryName"]): Promise<string> {
  const category = await prisma.category.findUnique({ where: { name: categoryName } });
  if (!category) {
    throw new Error(`Missing category: ${categoryName}`);
  }
  return category.id;
}

async function pickCoverImageUrl(item: SeedItem): Promise<string | null> {
  return findLocalImageUrl({
    name: item.name,
    brandName: item.brandName
  });
}

async function upsertGearItem(item: SeedItem, brandId: string | null, categoryId: string): Promise<string> {
  const existing = await prisma.gearItem.findFirst({
    where: {
      name: item.name,
      brandId,
      categoryId
    }
  });

  const maybeCoverImage = await pickCoverImageUrl(item);

  if (existing) {
    await prisma.gearItem.update({
      where: { id: existing.id },
      data: {
        notes: existing.notes ?? "首批导入",
        coverImageUrl: maybeCoverImage
      }
    });
    return existing.id;
  }

  const created = await prisma.gearItem.create({
    data: {
      name: item.name,
      brandId,
      categoryId,
      notes: "首批导入",
      coverImageUrl: maybeCoverImage
    }
  });

  return created.id;
}

async function resetInitialPurchases() {
  await prisma.purchaseRecord.deleteMany({
    where: {
      channel: "初始导入"
    }
  });
}

async function cleanupStaleImportedGear(validNames: Set<string>) {
  const imported = await prisma.gearItem.findMany({
    where: {
      notes: "首批导入"
    },
    include: {
      purchases: true,
      ratings: true,
      externalViews: true
    }
  });

  for (const item of imported) {
    if (validNames.has(item.name)) continue;
    if (item.purchases.length || item.ratings.length || item.externalViews.length) continue;

    await prisma.gearItem.delete({ where: { id: item.id } });
  }
}

async function createInitialPurchase(item: SeedItem) {
  const brandId = await findOrCreateBrandId(item.brandName);
  const categoryId = await findCategoryId(item.categoryName);
  const gearItemId = await upsertGearItem(item, brandId, categoryId);

  await prisma.purchaseRecord.create({
    data: {
      gearItemId,
      brandId,
      categoryId,
      itemNameSnapshot: item.name,
      unitPriceCny: new Prisma.Decimal(0),
      quantity: item.quantity,
      totalPriceCny: new Prisma.Decimal(0),
      purchaseDate: new Date(item.purchaseDate),
      channel: "初始导入",
      itemStatus: item.itemStatus,
      notes: item.note ?? null
    }
  });
}

async function main() {
  await resetInitialPurchases();

  for (const item of DATA) {
    await createInitialPurchase(item);
  }

  await cleanupStaleImportedGear(new Set(DATA.map((item) => item.name)));

  console.log(`Synced ${DATA.length} initial records.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
