import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { calcTotalPrice } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { resolveOrCreateGearItemIdFromPurchase } from "@/lib/server/gear-from-purchase";
import { purchaseSchema } from "@/lib/validators/purchase";

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = purchaseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const item = await prisma.$transaction(async (tx) => {
      const brandId = await findOrCreateBrandId(input.brandName ?? null, tx);
      const gearItemId = await resolveOrCreateGearItemIdFromPurchase(tx, {
        itemNameSnapshot: input.itemNameSnapshot,
        brandId,
        modelCode: input.modelCode ?? null,
        categoryId: input.categoryId ?? null,
        gearItemId: input.gearItemId ?? null
      });
      const totalPrice = calcTotalPrice(input.unitPriceCny, input.quantity, input.totalPriceCny ?? undefined);

      return tx.purchaseRecord.create({
        data: {
          gearItemId,
          brandId,
          categoryId: input.categoryId ?? null,
          itemNameSnapshot: input.itemNameSnapshot,
          unitPriceCny: new Prisma.Decimal(input.unitPriceCny),
          quantity: input.quantity,
          totalPriceCny: new Prisma.Decimal(totalPrice),
          purchaseDate: new Date(input.purchaseDate),
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
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create purchase record", detail: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const brandId = searchParams.get("brandId") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = Math.min(200, Number(searchParams.get("pageSize") ?? "50"));

  const where: Prisma.PurchaseRecordWhereInput = {
    brandId,
    categoryId,
    purchaseDate: {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined
    }
  };

  const [items, total] = await Promise.all([
    prisma.purchaseRecord.findMany({
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
            modelCode: true
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
    }),
    prisma.purchaseRecord.count({ where })
  ]);

  return NextResponse.json({
    page,
    pageSize,
    total,
    items
  });
}
