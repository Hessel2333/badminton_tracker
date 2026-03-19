import { unstable_cache } from "next/cache";
import { ItemStatus } from "@prisma/client";

import { getOverview } from "@/lib/analytics/queries";
import { prisma } from "@/lib/prisma";

export const DASHBOARD_DATA_TAG = "dashboard-data";

export const getCachedDashboardData = unstable_cache(
  async () => {
    const [overview, groupedStatus, recentArchive] = await Promise.all([
      getOverview(),
      prisma.purchaseRecord.groupBy({
        by: ["itemStatus"],
        _sum: { quantity: true }
      }),
      prisma.purchaseRecord.findMany({
        take: 5,
        orderBy: { purchaseDate: "desc" },
        include: {
          brand: true,
          category: true,
          gearItem: {
            select: {
              coverImageUrl: true
            }
          }
        }
      })
    ]);

    const quantityByStatus = new Map(
      groupedStatus.map((item) => [item.itemStatus, item._sum.quantity ?? 0])
    );

    const archiveState = [
      {
        key: "active",
        quantity: quantityByStatus.get(ItemStatus.IN_USE) ?? 0,
        description: "当前正在打和正在消耗的装备。"
      },
      {
        key: "stored",
        quantity: quantityByStatus.get(ItemStatus.STORED) ?? 0,
        description: "已经入档，但暂时没有投入使用。"
      },
      {
        key: "retired",
        quantity:
          (quantityByStatus.get(ItemStatus.USED_UP) ?? 0) +
          (quantityByStatus.get(ItemStatus.WORN_OUT) ?? 0),
        description: "完成生命周期、可以回看取舍记录。"
      }
    ] as const;

    return {
      overview,
      recentArchive,
      archiveState
    };
  },
  ["dashboard-page-data"],
  {
    tags: [DASHBOARD_DATA_TAG],
    revalidate: 60
  }
);
