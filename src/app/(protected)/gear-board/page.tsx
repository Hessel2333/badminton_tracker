import { ItemStatus } from "@prisma/client";

import { GearPegboardManager } from "@/components/forms/GearPegboardManager";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";

export default async function GearBoardPage() {
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
          itemStatus: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title="洞洞板视角"
        subtitle="纯陈列模式：画布只展示装备图像，支持自由拖拽与推荐布局。"
      />
      <GearPegboardManager
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

