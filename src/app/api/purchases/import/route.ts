import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { calcTotalPrice } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { resolveOrCreateGearItemIdFromPurchase } from "@/lib/server/gear-from-purchase";

function parseCSV(csv: string) {
  const rows = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const [headerRow, ...dataRows] = rows;
  const header = headerRow
    .split(",")
    .map((item) => item.trim().replace(/^"|"$/g, ""));
  const index = Object.fromEntries(header.map((key, i) => [key, i])) as Record<string, number>;

  function read(parts: string[], key: string, fallbackIndex: number) {
    const i = index[key] ?? fallbackIndex;
    return parts[i] ?? "";
  }

  return dataRows.map((row) => {
    const parts = row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const itemNameSnapshot = read(parts, "itemNameSnapshot", 0);
    const brandName = read(parts, "brandName", 1);
    const modelCode = read(parts, "modelCode", 2);
    const unitPrice = read(parts, "unitPriceCny", 3);
    const quantity = read(parts, "quantity", 4);
    const totalPrice = read(parts, "totalPriceCny", 5);
    const purchaseDate = read(parts, "purchaseDate", 6);
    const channel = read(parts, "channel", 7);
    const itemStatus = read(parts, "itemStatus", 8);

    return {
      itemNameSnapshot,
      brandName,
      modelCode,
      unitPriceCny: Number(unitPrice || "0"),
      quantity: Number(quantity || "1"),
      totalPriceCny: Number(totalPrice || "0"),
      purchaseDate,
      channel,
      itemStatus: itemStatus || "IN_USE"
    };
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { csv } = (await request.json()) as { csv?: string };
  if (!csv) {
    return NextResponse.json({ error: "Missing csv content" }, { status: 400 });
  }

  const parsed = parseCSV(csv);

  const created = await prisma.$transaction(async (tx) => {
    const idsByNormalized = new Map<string, string>();
    const results = [];

    for (const item of parsed) {
      let brandId: string | null = null;
      if (item.brandName) {
        const normalized = item.brandName.trim().toLowerCase().replace(/\s+/g, " ");
        const cached = idsByNormalized.get(normalized);
        if (cached) {
          brandId = cached;
        } else {
          const createdBrandId = await findOrCreateBrandId(item.brandName, tx);
          brandId = createdBrandId;
          if (createdBrandId) {
            idsByNormalized.set(normalized, createdBrandId);
          }
        }
      }

      const total = calcTotalPrice(item.unitPriceCny, item.quantity, item.totalPriceCny);

      const gearItemId = await resolveOrCreateGearItemIdFromPurchase(tx, {
        itemNameSnapshot: item.itemNameSnapshot,
        brandId,
        modelCode: item.modelCode || null,
        categoryId: null
      });

      const row = await tx.purchaseRecord.create({
        data: {
          gearItemId,
          itemNameSnapshot: item.itemNameSnapshot,
          brandId,
          unitPriceCny: new Prisma.Decimal(item.unitPriceCny),
          quantity: item.quantity,
          totalPriceCny: new Prisma.Decimal(total),
          purchaseDate: new Date(item.purchaseDate),
          channel: item.channel,
          itemStatus:
            item.itemStatus === "USED_UP" ||
            item.itemStatus === "WORN_OUT" ||
            item.itemStatus === "STORED"
              ? item.itemStatus
              : "IN_USE"
        }
      });
      results.push(row);
    }

    return results;
  });

  return NextResponse.json({ count: created.length });
}
