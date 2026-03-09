import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { toNumber } from "@/lib/server/number";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const rows = await prisma.purchaseRecord.findMany({
    include: {
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
        item.itemNameSnapshot,
        item.brand?.name ?? "",
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
