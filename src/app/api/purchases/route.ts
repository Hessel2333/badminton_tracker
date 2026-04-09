import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { calcTotalPrice, canonicalProductName } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import {
  DEFAULT_PURCHASE_PAGE_SIZE,
  getCachedDefaultPurchaseRecords,
  serializePurchaseRow
} from "@/lib/server/commerce-data";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { resolveOrCreateGearItemIdFromPurchase } from "@/lib/server/gear-from-purchase";
import { createRequestMetrics } from "@/lib/server/perf";
import { createPurchaseEvent } from "@/lib/server/purchase-events";
import { findLocalImageUrl } from "@/lib/server/local-image-library";
import { revalidatePurchaseDerivedData } from "@/lib/server/revalidate-app-data";
import { purchaseSchema } from "@/lib/validators/purchase";

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      console.error("Zod Validation Failed:", JSON.stringify(parsed.error.flatten(), null, 2));
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const canonicalItemName = canonicalProductName({
      name: input.itemNameSnapshot,
      brandName: input.brandName ?? undefined,
      modelCode: input.modelCode ?? undefined
    });

    // 事务内避免做本地文件系统扫描（会导致 interactive transaction 超时）
    const localCoverImage =
      input.allowAutoImageLookup === false || input.gearCoverImageUrl
        ? null
        : await findLocalImageUrl({
            name: canonicalItemName,
            brandName: input.brandName ?? null,
            modelCode: input.modelCode ?? null
          });

    const item = await prisma.$transaction(async (tx) => {
      const brandId = await findOrCreateBrandId(input.brandName ?? null, tx);
      const gearItemId = await resolveOrCreateGearItemIdFromPurchase(tx, {
        itemNameSnapshot: canonicalItemName,
        brandName: input.brandName ?? null,
        brandId,
        modelCode: input.modelCode ?? null,
        categoryId: input.categoryId ?? null,
        gearItemId: input.gearItemId ?? null,
        // 事务内不再触发自动图片查找；若需要则在事务外预先计算 localCoverImage
        allowAutoImageLookup: false,
        coverImageUrl: input.gearCoverImageUrl ?? localCoverImage ?? null
      });
      const totalPrice = calcTotalPrice(input.unitPriceCny, input.quantity, input.totalPriceCny ?? undefined);

      const created = await tx.purchaseRecord.create({
        data: {
          gearItemId,
          brandId,
          categoryId: input.categoryId ?? null,
          itemNameSnapshot: canonicalItemName,
          unitPriceCny: new Prisma.Decimal(input.unitPriceCny),
          quantity: input.quantity,
          totalPriceCny: new Prisma.Decimal(totalPrice),
          purchaseDate: new Date(input.purchaseDate),
          usedUpAt: null,
          channel: input.channel ?? null,
          itemStatus: input.itemStatus,
          isSecondHand: input.isSecondHand ?? false,
          notes: input.notes ?? null,
          receiptImageUrl: input.receiptImageUrl ?? null
        },
        include: {
          brand: true,
          category: true
        }
      });

      await createPurchaseEvent(tx, {
        purchaseRecordId: created.id,
        gearItemId: created.gearItemId,
        eventType: "PURCHASED",
        quantityDelta: created.quantity,
        toStatus: created.itemStatus,
        eventAt: created.purchaseDate
      });

      return created;
    }, { timeout: 15_000 });

    await revalidatePurchaseDerivedData();

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create purchase record", detail: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const metrics = createRequestMetrics("api.purchases.get");
  const auth = await metrics.track("auth", () => requireSession());
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const brandId = searchParams.get("brandId") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(200, Number(searchParams.get("pageSize") ?? String(DEFAULT_PURCHASE_PAGE_SIZE)));
  const includeTotal = searchParams.get("includeTotal") === "1";
  const shouldUseDefaultCache =
    !brandId &&
    !categoryId &&
    !from &&
    !to &&
    !includeTotal &&
    Math.max(page, 1) === 1 &&
    pageSize === DEFAULT_PURCHASE_PAGE_SIZE;

  const where: Prisma.PurchaseRecordWhereInput = {
    brandId,
    categoryId,
    purchaseDate: {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined
    }
  };

  if (shouldUseDefaultCache) {
    const items = await metrics.track("cache", () => getCachedDefaultPurchaseRecords());
    metrics.log({ cached: true, pageSize });
    return NextResponse.json(
      {
        page,
        pageSize,
        items: items.map(serializePurchaseRow)
      },
      {
        headers: metrics.headers()
      }
    );
  }

  const items = await metrics.track("query", () => prisma.purchaseRecord.findMany({
      where,
      select: {
        id: true,
        brandId: true,
        categoryId: true,
        itemNameSnapshot: true,
        unitPriceCny: true,
        quantity: true,
        totalPriceCny: true,
        itemStatus: true,
        purchaseDate: true,
        channel: true,
        notes: true,
        brand: {
          select: {
            id: true,
            name: true
          }
        },
        gearItem: {
          select: {
            id: true,
            modelCode: true,
            coverImageUrl: true
          }
        },
        category: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { purchaseDate: "desc" },
      skip: (Math.max(page, 1) - 1) * pageSize,
      take: pageSize
    }));

  const total = includeTotal ? await metrics.track("count", () => prisma.purchaseRecord.count({ where })) : undefined;
  metrics.log({ cached: false, pageSize, includeTotal });

  return NextResponse.json(
    {
      page,
      pageSize,
      total,
      items: items.map(serializePurchaseRow)
    },
    {
      headers: metrics.headers()
    }
  );
}
