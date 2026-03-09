import { PrismaClient } from "@prisma/client";

import { findLocalImageUrl } from "../src/lib/server/local-image-library";

const prisma = new PrismaClient();

async function main() {
  const items = await prisma.gearItem.findMany({
    select: {
      id: true,
      name: true,
      modelCode: true,
      coverImageUrl: true,
      brand: {
        select: {
          name: true
        }
      }
    }
  });

  const changed: Array<{
    name: string;
    before: string | null;
    after: string;
  }> = [];

  for (const item of items) {
    const nextUrl = await findLocalImageUrl({
      name: item.name,
      brandName: item.brand?.name ?? null,
      modelCode: item.modelCode ?? null
    });

    if (!nextUrl || nextUrl === item.coverImageUrl) continue;

    await prisma.gearItem.update({
      where: { id: item.id },
      data: { coverImageUrl: nextUrl }
    });

    changed.push({
      name: item.name,
      before: item.coverImageUrl ?? null,
      after: nextUrl
    });
  }

  console.log(JSON.stringify({ updated: changed.length, changed }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

