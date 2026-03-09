import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { normalizeBrandName } from "@/lib/business-rules";

type BrandClient = PrismaClient | Prisma.TransactionClient;

export async function findOrCreateBrandId(brandName?: string | null, client: BrandClient = prisma) {
  if (!brandName) {
    return null;
  }

  const name = brandName.trim();
  if (!name) {
    return null;
  }

  const normalizedName = normalizeBrandName(name);

  const brand = await client.brand.upsert({
    where: { normalizedName },
    update: { name },
    create: {
      name,
      normalizedName
    }
  });

  return brand.id;
}
