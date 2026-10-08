import { unstable_cache } from "next/cache";
import { ItemStatus } from "@prisma/client";

import { getOverview } from "@/lib/analytics/queries";
import { prisma } from "@/lib/prisma";

export const DASHBOARD_DATA_TAG = "dashboard-data";

export const getCachedDashboardData = unstable_cache(
  async (userId: string) => {
    const [overview, groupedStatus, recentArchive] = await Promise.all([
      getOverview(userId),
      prisma.purchaseRecord.groupBy({
        by: ["itemStatus"],
        where: { userId },
        _sum: { quantity: true }
      }),
      prisma.purchaseRecord.findMany({
        where: { userId },
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
        quantity: quantityByStatus.get(ItemStatus.IN_USE) ?? 0
      },
      {
        key: "stored",
        quantity: quantityByStatus.get(ItemStatus.STORED) ?? 0
      },
      {
        key: "retired",
        quantity:
          (quantityByStatus.get(ItemStatus.USED_UP) ?? 0) +
          (quantityByStatus.get(ItemStatus.WORN_OUT) ?? 0)
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
