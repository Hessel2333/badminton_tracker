import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { revalidateAllCoreData } from "@/lib/server/revalidate-app-data";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const [brands, categories, gear, purchases, events, projectCatalogOverrides, wishlist, transitions] = await Promise.all([
    prisma.brand.findMany(),
    prisma.category.findMany(),
    prisma.gearItem.findMany(),
    prisma.purchaseRecord.findMany(),
    prisma.purchaseEvent.findMany(),
    prisma.projectCatalogOverride.findMany(),
    prisma.wishlistItem.findMany(),
    prisma.wishlistTransition.findMany()
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    brands,
    categories,
    gear,
    purchases,
    events,
    projectCatalogOverrides,
    wishlist,
    transitions
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="badminton-tracker-backup-${new Date().toISOString().slice(0, 10)}.json"`
    }
  });
}

type BackupPayload = {
  exportedAt?: string;
  brands?: Array<{
    id: string;
    name: string;
    normalizedName: string;
    createdAt: string;
  }>;
  categories?: Array<{
    id: string;
    name: string;
    isSystem: boolean;
    sortOrder: number;
    createdAt: string;
  }>;
  gear?: Array<{
    id: string;
    name: string;
    brandId: string | null;
    categoryId: string | null;
    modelCode: string | null;
    specJson: Prisma.JsonValue | null;
    coverImageUrl: string | null;
    notes: string | null;
    createdAt: string;
  }>;
  purchases?: Array<{
    id: string;
    gearItemId: string | null;
    brandId: string | null;
    categoryId: string | null;
    itemNameSnapshot: string;
    unitPriceCny: string | number;
    quantity: number;
    totalPriceCny: string | number;
    purchaseDate: string;
    usedUpAt: string | null;
    channel: string | null;
    itemStatus: "IN_USE" | "USED_UP" | "WORN_OUT" | "STORED";
    isSecondHand: boolean;
    notes: string | null;
    receiptImageUrl: string | null;
    createdAt: string;
  }>;
  events?: Array<{
    id: string;
    purchaseRecordId: string | null;
    gearItemId: string | null;
    eventType: "PURCHASED" | "CONSUMED" | "DAMAGED" | "STATUS_CHANGED";
    quantityDelta: number;
    fromStatus: "IN_USE" | "USED_UP" | "WORN_OUT" | "STORED" | null;
    toStatus: "IN_USE" | "USED_UP" | "WORN_OUT" | "STORED" | null;
    eventAt: string;
    notes: string | null;
    createdAt: string;
  }>;
  projectCatalogOverrides?: Array<{
    id: string;
    entryKey: string;
    name: string;
    brandName: string;
    modelCode: string | null;
    categoryName: string;
    suggestedUnitPriceCny: string | number | null;
    popularity: number;
    imageUrl: string | null;
    tagsJson: Prisma.JsonValue | null;
    createdAt: string;
    updatedAt: string;
  }>;
  wishlist?: Array<{
    id: string;
    name: string;
    brandId: string | null;
    categoryId: string | null;
    targetPriceCny: string | number | null;
    currentSeenPriceCny: string | number | null;
    priority: number;
    status: "WANT" | "WATCHING" | "PURCHASED" | "DROPPED";
    sourceUrl: string | null;
    imageUrl: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  transitions?: Array<{
    id: string;
    wishlistItemId: string;
    fromStatus: "WANT" | "WATCHING" | "PURCHASED" | "DROPPED";
    toStatus: "WANT" | "WATCHING" | "PURCHASED" | "DROPPED";
    changedAt: string;
    linkedPurchaseId: string | null;
  }>;
};

function mapForeignId(sourceId: string | null | undefined, idMap: Map<string, string>) {
  if (!sourceId) return null;
  return idMap.get(sourceId) ?? sourceId;
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const payload = (await request.json()) as BackupPayload;

    await prisma.$transaction(async (tx) => {
      const brandIdMap = new Map<string, string>();
      const categoryIdMap = new Map<string, string>();
      const gearIdMap = new Map<string, string>();
      const purchaseIdMap = new Map<string, string>();
      const wishlistIdMap = new Map<string, string>();

      for (const brand of payload.brands ?? []) {
        const saved = await tx.brand.upsert({
          where: { normalizedName: brand.normalizedName },
          update: {
            name: brand.name,
            createdAt: new Date(brand.createdAt)
          },
          create: {
            name: brand.name,
            normalizedName: brand.normalizedName,
            createdAt: new Date(brand.createdAt)
          }
        });
        brandIdMap.set(brand.id, saved.id);
      }

      for (const category of payload.categories ?? []) {
        const saved = await tx.category.upsert({
          where: { name: category.name },
          update: {
            isSystem: category.isSystem,
            sortOrder: category.sortOrder,
            createdAt: new Date(category.createdAt)
          },
          create: {
            name: category.name,
            isSystem: category.isSystem,
            sortOrder: category.sortOrder,
            createdAt: new Date(category.createdAt)
          }
        });
        categoryIdMap.set(category.id, saved.id);
      }

      for (const gear of payload.gear ?? []) {
        const saved = await tx.gearItem.upsert({
          where: { id: gear.id },
          update: {
            name: gear.name,
            brandId: mapForeignId(gear.brandId, brandIdMap),
            categoryId: mapForeignId(gear.categoryId, categoryIdMap),
            modelCode: gear.modelCode,
            specJson: gear.specJson ?? undefined,
            coverImageUrl: gear.coverImageUrl,
            notes: gear.notes,
            createdAt: new Date(gear.createdAt)
          },
          create: {
            id: gear.id,
            name: gear.name,
            brandId: mapForeignId(gear.brandId, brandIdMap),
            categoryId: mapForeignId(gear.categoryId, categoryIdMap),
            modelCode: gear.modelCode,
            specJson: gear.specJson ?? undefined,
            coverImageUrl: gear.coverImageUrl,
            notes: gear.notes,
            createdAt: new Date(gear.createdAt)
          }
        });
        gearIdMap.set(gear.id, saved.id);
      }

      for (const purchase of payload.purchases ?? []) {
        const saved = await tx.purchaseRecord.upsert({
          where: { id: purchase.id },
          update: {
            gearItemId: mapForeignId(purchase.gearItemId, gearIdMap),
            brandId: mapForeignId(purchase.brandId, brandIdMap),
            categoryId: mapForeignId(purchase.categoryId, categoryIdMap),
            itemNameSnapshot: purchase.itemNameSnapshot,
            unitPriceCny: new Prisma.Decimal(purchase.unitPriceCny),
            quantity: purchase.quantity,
            totalPriceCny: new Prisma.Decimal(purchase.totalPriceCny),
            purchaseDate: new Date(purchase.purchaseDate),
            usedUpAt: purchase.usedUpAt ? new Date(purchase.usedUpAt) : null,
            channel: purchase.channel,
            itemStatus: purchase.itemStatus,
            isSecondHand: purchase.isSecondHand,
            notes: purchase.notes,
            receiptImageUrl: purchase.receiptImageUrl,
            createdAt: new Date(purchase.createdAt)
          },
          create: {
            id: purchase.id,
            gearItemId: mapForeignId(purchase.gearItemId, gearIdMap),
            brandId: mapForeignId(purchase.brandId, brandIdMap),
            categoryId: mapForeignId(purchase.categoryId, categoryIdMap),
            itemNameSnapshot: purchase.itemNameSnapshot,
            unitPriceCny: new Prisma.Decimal(purchase.unitPriceCny),
            quantity: purchase.quantity,
            totalPriceCny: new Prisma.Decimal(purchase.totalPriceCny),
            purchaseDate: new Date(purchase.purchaseDate),
            usedUpAt: purchase.usedUpAt ? new Date(purchase.usedUpAt) : null,
            channel: purchase.channel,
            itemStatus: purchase.itemStatus,
            isSecondHand: purchase.isSecondHand,
            notes: purchase.notes,
            receiptImageUrl: purchase.receiptImageUrl,
            createdAt: new Date(purchase.createdAt)
          }
        });
        purchaseIdMap.set(purchase.id, saved.id);
      }

      for (const event of payload.events ?? []) {
        await tx.purchaseEvent.upsert({
          where: { id: event.id },
          update: {
            purchaseRecordId: mapForeignId(event.purchaseRecordId, purchaseIdMap),
            gearItemId: mapForeignId(event.gearItemId, gearIdMap),
            eventType: event.eventType,
            quantityDelta: event.quantityDelta,
            fromStatus: event.fromStatus,
            toStatus: event.toStatus,
            eventAt: new Date(event.eventAt),
            notes: event.notes,
            createdAt: new Date(event.createdAt)
          },
          create: {
            id: event.id,
            purchaseRecordId: mapForeignId(event.purchaseRecordId, purchaseIdMap),
            gearItemId: mapForeignId(event.gearItemId, gearIdMap),
            eventType: event.eventType,
            quantityDelta: event.quantityDelta,
            fromStatus: event.fromStatus,
            toStatus: event.toStatus,
            eventAt: new Date(event.eventAt),
            notes: event.notes,
            createdAt: new Date(event.createdAt)
          }
        });
      }

      for (const item of payload.projectCatalogOverrides ?? []) {
        await tx.projectCatalogOverride.upsert({
          where: { entryKey: item.entryKey },
          update: {
            entryKey: item.entryKey,
            name: item.name,
            brandName: item.brandName,
            modelCode: item.modelCode,
            categoryName: item.categoryName,
            suggestedUnitPriceCny:
              item.suggestedUnitPriceCny == null ? null : new Prisma.Decimal(item.suggestedUnitPriceCny),
            popularity: item.popularity,
            imageUrl: item.imageUrl,
            tagsJson: item.tagsJson ?? undefined,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt)
          },
          create: {
            entryKey: item.entryKey,
            name: item.name,
            brandName: item.brandName,
            modelCode: item.modelCode,
            categoryName: item.categoryName,
            suggestedUnitPriceCny:
              item.suggestedUnitPriceCny == null ? null : new Prisma.Decimal(item.suggestedUnitPriceCny),
            popularity: item.popularity,
            imageUrl: item.imageUrl,
            tagsJson: item.tagsJson ?? undefined,
            createdAt: new Date(item.createdAt),
            updatedAt: new Date(item.updatedAt)
          }
        });
      }

      for (const wishlist of payload.wishlist ?? []) {
        const saved = await tx.wishlistItem.upsert({
          where: { id: wishlist.id },
          update: {
            name: wishlist.name,
            brandId: mapForeignId(wishlist.brandId, brandIdMap),
            categoryId: mapForeignId(wishlist.categoryId, categoryIdMap),
            targetPriceCny:
              wishlist.targetPriceCny == null ? null : new Prisma.Decimal(wishlist.targetPriceCny),
            currentSeenPriceCny:
              wishlist.currentSeenPriceCny == null ? null : new Prisma.Decimal(wishlist.currentSeenPriceCny),
            priority: wishlist.priority,
            status: wishlist.status,
            sourceUrl: wishlist.sourceUrl,
            imageUrl: wishlist.imageUrl,
            notes: wishlist.notes,
            createdAt: new Date(wishlist.createdAt),
            updatedAt: new Date(wishlist.updatedAt)
          },
          create: {
            id: wishlist.id,
            name: wishlist.name,
            brandId: mapForeignId(wishlist.brandId, brandIdMap),
            categoryId: mapForeignId(wishlist.categoryId, categoryIdMap),
            targetPriceCny:
              wishlist.targetPriceCny == null ? null : new Prisma.Decimal(wishlist.targetPriceCny),
            currentSeenPriceCny:
              wishlist.currentSeenPriceCny == null ? null : new Prisma.Decimal(wishlist.currentSeenPriceCny),
            priority: wishlist.priority,
            status: wishlist.status,
            sourceUrl: wishlist.sourceUrl,
            imageUrl: wishlist.imageUrl,
            notes: wishlist.notes,
            createdAt: new Date(wishlist.createdAt),
            updatedAt: new Date(wishlist.updatedAt)
          }
        });
        wishlistIdMap.set(wishlist.id, saved.id);
      }

      for (const transition of payload.transitions ?? []) {
        await tx.wishlistTransition.upsert({
          where: { id: transition.id },
          update: {
            wishlistItemId: mapForeignId(transition.wishlistItemId, wishlistIdMap) ?? transition.wishlistItemId,
            fromStatus: transition.fromStatus,
            toStatus: transition.toStatus,
            changedAt: new Date(transition.changedAt),
            linkedPurchaseId: mapForeignId(transition.linkedPurchaseId, purchaseIdMap)
          },
          create: {
            id: transition.id,
            wishlistItemId: mapForeignId(transition.wishlistItemId, wishlistIdMap) ?? transition.wishlistItemId,
            fromStatus: transition.fromStatus,
            toStatus: transition.toStatus,
            changedAt: new Date(transition.changedAt),
            linkedPurchaseId: mapForeignId(transition.linkedPurchaseId, purchaseIdMap)
          }
        });
      }
    });

    await revalidateAllCoreData();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "备份导入失败", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
