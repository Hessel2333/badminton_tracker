import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { canonicalBrandDisplayName, normalizeBrandGroupName } from "@/lib/business-rules";

type BrandClient = PrismaClient | Prisma.TransactionClient;

export async function findOrCreateBrandId(brandName?: string | null, client: BrandClient = prisma) {
  if (!brandName) {
    return null;
  }

  const name = canonicalBrandDisplayName(brandName);
  if (!name) {
    return null;
  }

  const normalizedName = normalizeBrandGroupName(name);

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
