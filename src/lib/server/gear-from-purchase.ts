import { Prisma } from "@prisma/client";

import { canonicalProductName } from "@/lib/business-rules";
import { findLocalImageUrl } from "@/lib/server/local-image-library";

type PurchaseGearInput = {
  itemNameSnapshot: string;
  brandName?: string | null;
  brandId?: string | null;
  modelCode?: string | null;
  categoryId?: string | null;
  gearItemId?: string | null;
  allowAutoImageLookup?: boolean;
  coverImageUrl?: string | null;
};

type DbClient = Prisma.TransactionClient;

function canonicalName(name: string, brandName?: string | null, modelCode?: string | null) {
  return canonicalProductName({ name, brandName, modelCode });
}

function canonicalModelCode(modelCode?: string | null) {
  if (!modelCode) return null;
  const normalized = modelCode.trim().replace(/\s+/g, " ");
  return normalized.length ? normalized : null;
}

async function syncGearItemFromPurchaseInput(
  db: DbClient,
  gearItemId: string,
  input: PurchaseGearInput
) {
  const nextName = canonicalName(input.itemNameSnapshot, input.brandName, input.modelCode);
  const nextBrandId = input.brandId ?? undefined;
  const nextCategoryId = input.categoryId ?? undefined;
  const nextModelCode = canonicalModelCode(input.modelCode) ?? undefined;
  const nextCoverImageUrl = input.coverImageUrl ?? undefined;

  if (!nextName && !nextBrandId && !nextCategoryId && !nextModelCode && !nextCoverImageUrl) return;

  await db.gearItem.update({
    where: { id: gearItemId },
    data: {
      name: nextName || undefined,
      brandId: nextBrandId,
      categoryId: nextCategoryId,
      modelCode: nextModelCode,
      coverImageUrl: nextCoverImageUrl
    }
  });
}

export async function resolveOrCreateGearItemIdFromPurchase(
  db: DbClient,
  input: PurchaseGearInput
) {
  const name = canonicalName(input.itemNameSnapshot, input.brandName, input.modelCode);
  if (!name) return null;
  const modelCode = canonicalModelCode(input.modelCode);

  if (input.gearItemId) {
      const existing = await db.gearItem.findUnique({
      where: { id: input.gearItemId },
      select: { id: true }
    });
    if (existing) {
      await syncGearItemFromPurchaseInput(db, existing.id, input);
      return existing.id;
    }
  }

  if (modelCode) {
    const byNameAndModel = await db.gearItem.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        modelCode: { equals: modelCode, mode: "insensitive" },
        brandId: input.brandId ?? null,
        categoryId: input.categoryId ?? null
      },
      select: { id: true }
    });
    if (byNameAndModel) {
      await syncGearItemFromPurchaseInput(db, byNameAndModel.id, input);
      return byNameAndModel.id;
    }
  }

  const byBrandAndCategory = await db.gearItem.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive"
      },
      brandId: input.brandId ?? null,
      categoryId: input.categoryId ?? null,
      ...(modelCode
        ? {
          OR: [
            { modelCode: { equals: modelCode, mode: "insensitive" } },
            { modelCode: null }
          ]
        }
        : {})
    },
    select: { id: true }
  });
  if (byBrandAndCategory) {
    await syncGearItemFromPurchaseInput(db, byBrandAndCategory.id, input);
    return byBrandAndCategory.id;
  }

  const byBrand = input.brandId
    ? await db.gearItem.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive"
        },
        brandId: input.brandId,
        ...(modelCode
          ? {
            OR: [
              { modelCode: { equals: modelCode, mode: "insensitive" } },
              { modelCode: null }
            ]
          }
          : {})
      },
      select: { id: true }
    })
    : null;
  if (byBrand) {
    await syncGearItemFromPurchaseInput(db, byBrand.id, input);
    return byBrand.id;
  }

  const byName = await db.gearItem.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive"
      },
      ...(modelCode
        ? {
          OR: [
            { modelCode: { equals: modelCode, mode: "insensitive" } },
            { modelCode: null }
          ]
        }
        : {})
    },
    select: { id: true }
  });
  if (byName) {
    await syncGearItemFromPurchaseInput(db, byName.id, input);
    return byName.id;
  }

  const localCoverImage = input.allowAutoImageLookup === false
    ? null
    : await findLocalImageUrl({
      name,
      modelCode
    });
  const created = await db.gearItem.create({
    data: {
      name,
      brandId: input.brandId ?? null,
      categoryId: input.categoryId ?? null,
      modelCode,
      coverImageUrl: input.coverImageUrl ?? localCoverImage ?? null
    },
    select: { id: true }
  });

  return created.id;
}
