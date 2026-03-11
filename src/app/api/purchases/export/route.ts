import { NextResponse } from "next/server";

import { canonicalOptionalBrandDisplayName, canonicalProductName } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { toNumber } from "@/lib/server/number";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const rows = await prisma.purchaseRecord.findMany({
    include: {
      category: true,
      brand: true,
      gearItem: {
        select: {
          modelCode: true
        }
      }
    },
    orderBy: { purchaseDate: "desc" }
  });

  const header =
    "itemNameSnapshot,brandName,modelCode,unitPriceCny,quantity,totalPriceCny,purchaseDate,channel,itemStatus";
  const body = rows
    .map((item) =>
      [
        canonicalProductName({
          name: item.itemNameSnapshot,
          brandName: item.brand?.name ?? "",
          modelCode: item.gearItem?.modelCode ?? "",
          categoryName: item.category?.name ?? ""
        }),
        canonicalOptionalBrandDisplayName(item.brand?.name),
        item.gearItem?.modelCode ?? "",
        toNumber(item.unitPriceCny),
        item.quantity,
        toNumber(item.totalPriceCny),
        item.purchaseDate.toISOString(),
        item.channel ?? "",
        item.itemStatus
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  return new NextResponse(`${header}\n${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=purchases.csv"
    }
  });
}
