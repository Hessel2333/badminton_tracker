import { notFound } from "next/navigation";

import { GearDetailEditor } from "@/components/forms/GearDetailEditor";
import { canonicalOptionalBrandDisplayName, canonicalProductName } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function GearDetailPage({ params }: Props) {
  const { id } = await params;

  const [item, categories] = await Promise.all([
    prisma.gearItem.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        categoryId: true,
        modelCode: true,
        coverImageUrl: true,
        notes: true,
        createdAt: true,
        brand: {
          select: { name: true }
        },
        category: {
          select: { name: true }
        },
        purchases: {
          orderBy: { purchaseDate: "desc" },
          take: 120,
          select: {
            id: true,
            categoryId: true,
            purchaseDate: true,
            itemNameSnapshot: true,
            itemStatus: true,
            unitPriceCny: true,
            quantity: true,
            totalPriceCny: true,
            channel: true,
            notes: true,
            isSecondHand: true,
            brand: {
              select: { name: true }
            },
            gearItem: {
              select: { modelCode: true }
            },
            category: {
              select: { name: true }
            }
          }
        },
        events: {
          orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }],
          take: 120,
          select: {
            id: true,
            eventType: true,
            quantityDelta: true,
            fromStatus: true,
            toStatus: true,
            eventAt: true,
            notes: true,
            purchaseRecord: {
              select: {
                itemNameSnapshot: true
              }
            }
          }
        }
      }
    }),
    prisma.category.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    })
  ]);

  if (!item) {
    notFound();
  }

  return (
    <GearDetailEditor
      categories={categories.map((category) => ({
        id: category.id,
        name: category.name
      }))}
      initialData={{
        id: item.id,
        name: canonicalProductName({
          name: item.name,
          brandName: item.brand?.name ?? "",
          modelCode: item.modelCode ?? "",
          categoryName: item.category?.name ?? ""
        }),
        brandName: canonicalOptionalBrandDisplayName(item.brand?.name),
        categoryId: item.categoryId ?? "",
        modelCode: item.modelCode ?? "",
        coverImageUrl: item.coverImageUrl ?? "",
        notes: item.notes ?? "",
        createdAt: item.createdAt.toISOString(),
        events: item.events.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          quantityDelta: event.quantityDelta,
          fromStatus: event.fromStatus ?? null,
          toStatus: event.toStatus ?? null,
          eventAt: event.eventAt.toISOString(),
          notes: event.notes ?? "",
          itemNameSnapshot: event.purchaseRecord?.itemNameSnapshot ?? ""
        })),
        purchases: item.purchases.map((purchase) => ({
          id: purchase.id,
          categoryId: purchase.categoryId ?? "",
          purchaseDate: purchase.purchaseDate.toISOString(),
          itemNameSnapshot: purchase.itemNameSnapshot,
          itemStatus: purchase.itemStatus,
          unitPriceCny: toNumber(purchase.unitPriceCny),
          quantity: purchase.quantity,
          totalPriceCny: toNumber(purchase.totalPriceCny),
          channel: purchase.channel ?? "",
          notes: purchase.notes ?? "",
          isSecondHand: purchase.isSecondHand,
          brand: purchase.brand ? { name: purchase.brand.name } : null,
          gearItem: purchase.gearItem ? { modelCode: purchase.gearItem.modelCode ?? "" } : null,
          category: purchase.category ? { name: purchase.category.name } : null
        }))
      }}
    />
  );
}
