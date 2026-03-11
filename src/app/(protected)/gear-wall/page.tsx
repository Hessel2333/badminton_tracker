import { GearWallManager } from "@/components/forms/GearWallManager";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";
import { ItemStatus } from "@prisma/client";

import { Grid } from "lucide-react";

export default async function GearWallPage() {
  const items = await prisma.gearItem.findMany({
    where: {
      purchases: {
        some: {}
      }
    },
    include: {
      brand: true,
      category: true,
      ratings: {
        orderBy: { ratedAt: "desc" },
        take: 1
      },
      purchases: {
        select: {
          quantity: true,
          itemStatus: true,
          purchaseDate: true,
          unitPriceCny: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Grid}
        title="羽迹档案"
        subtitle="以方格视角审视你的所有装备资产，支持按状态筛选与深度追溯。"
      />
      <GearWallManager
        initialItems={items.map((item) => ({
          activeQuantity: item.purchases.reduce(
            (sum, purchase) =>
              purchase.itemStatus === ItemStatus.IN_USE || purchase.itemStatus === ItemStatus.STORED
                ? sum + purchase.quantity
                : sum,
            0
          ),
          usedUpQuantity: item.purchases.reduce(
            (sum, purchase) =>
              purchase.itemStatus === ItemStatus.USED_UP ? sum + purchase.quantity : sum,
            0
          ),
          wornOutQuantity: item.purchases.reduce(
            (sum, purchase) =>
              purchase.itemStatus === ItemStatus.WORN_OUT ? sum + purchase.quantity : sum,
            0
          ),
          totalQuantity: item.purchases.reduce((sum, purchase) => sum + purchase.quantity, 0),
          createdAt: item.createdAt.toISOString(),
          latestPurchaseDate: item.purchases.length
            ? [...item.purchases]
              .sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime())[0]
              ?.purchaseDate.toISOString() ?? null
            : null,
          referenceUnitPriceCny: item.purchases.length
            ? toNumber(
              [...item.purchases]
                .sort((a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime())[0]
                ?.unitPriceCny ?? null
            )
            : null,
          id: item.id,
          name: item.name,
          coverImageUrl: item.coverImageUrl,
          modelCode: item.modelCode,
          brand: item.brand ? { name: item.brand.name } : null,
          category: item.category ? { name: item.category.name } : null,
          ratings: item.ratings.map((rating) => ({
            overall: toNumber(rating.overall)
          }))
        }))}
      />
    </div>
  );
}
