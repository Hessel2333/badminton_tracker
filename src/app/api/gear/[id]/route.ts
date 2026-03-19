import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { canonicalProductName, computeOverallRating } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { findLocalImageUrl } from "@/lib/server/local-image-library";
import { revalidateGearDerivedData } from "@/lib/server/revalidate-app-data";
import { gearUpdateSchema } from "@/lib/validators/gear";

type Context = {
  params: Promise<{ id: string }>;
};

async function getGearDetail(id: string) {
  return prisma.gearItem.findUnique({
    where: { id },
    include: {
      brand: true,
      category: true,
      ratings: {
        orderBy: { ratedAt: "desc" }
      },
      externalViews: {
        orderBy: { capturedAt: "desc" }
      },
      purchases: {
        include: {
          brand: true,
          category: true
        },
        orderBy: { purchaseDate: "desc" }
      },
      events: {
        orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }]
      }
    }
  });
}

export async function GET(_request: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const item = await getGearDetail(id);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function PUT(request: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = gearUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.gearItem.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const input = parsed.data;
  const category = input.categoryId
    ? await prisma.category.findUnique({
        where: { id: input.categoryId },
        select: { name: true }
      })
    : null;
  const canonicalName = canonicalProductName({
    name: input.name,
    brandName: input.brandName ?? "",
    modelCode: input.modelCode ?? "",
    categoryName: category?.name ?? ""
  });
  const brandId = await findOrCreateBrandId(input.brandName ?? null);
  const localCoverImage = await findLocalImageUrl({
    name: canonicalName,
    brandName: input.brandName,
    modelCode: input.modelCode
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.gearItem.update({
      where: { id },
      data: {
        name: canonicalName,
        brandId,
        categoryId: input.categoryId ?? null,
        modelCode: input.modelCode ?? null,
        specJson: input.specJson ?? Prisma.JsonNull,
        coverImageUrl: input.coverImageUrl ?? localCoverImage ?? null,
        notes: input.notes ?? null
      }
    });

    await tx.purchaseRecord.updateMany({
      where: { gearItemId: id },
      data: {
        itemNameSnapshot: canonicalName,
        brandId,
        categoryId: input.categoryId ?? null
      }
    });

    if (input.rating) {
      const dimensions = await tx.ratingDimension.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" }
      });

      const weightMap = Object.fromEntries(
        dimensions.map((dim) => [dim.key, Number(dim.weight)])
      ) as Partial<Record<"power" | "control" | "durability" | "comfort" | "value", number>>;

      const computedOverall = computeOverallRating(input.rating, weightMap);
      const ratingData = {
        power: new Prisma.Decimal(input.rating.power),
        control: new Prisma.Decimal(input.rating.control),
        durability: new Prisma.Decimal(input.rating.durability),
        comfort: new Prisma.Decimal(input.rating.comfort),
        value: new Prisma.Decimal(input.rating.value),
        overall: new Prisma.Decimal(input.rating.overall ?? computedOverall),
        reviewText: input.rating.reviewText ?? null
      };

      const latestRating = await tx.gearRating.findFirst({
        where: { gearItemId: id },
        orderBy: { ratedAt: "desc" },
        select: { id: true }
      });

      if (latestRating) {
        await tx.gearRating.update({
          where: { id: latestRating.id },
          data: ratingData
        });
      } else {
        await tx.gearRating.create({
          data: {
            gearItemId: id,
            ...ratingData
          }
        });
      }
    }

    if (input.externalReviews) {
      await tx.externalReview.deleteMany({
        where: { gearItemId: id }
      });

      if (input.externalReviews.length) {
        await tx.externalReview.createMany({
          data: input.externalReviews.map((item) => ({
            gearItemId: id,
            sourceName: item.sourceName,
            sourceUrl: item.sourceUrl,
            scoreText: item.scoreText ?? null,
            summaryText: item.summaryText ?? null
          }))
        });
      }
    }

    return tx.gearItem.findUnique({
      where: { id },
      include: {
        brand: true,
        category: true,
        ratings: {
          orderBy: { ratedAt: "desc" }
        },
        externalViews: {
          orderBy: { capturedAt: "desc" }
        },
        purchases: {
          include: {
            brand: true,
            category: true
          },
          orderBy: { purchaseDate: "desc" }
        },
        events: {
          orderBy: [{ eventAt: "desc" }, { createdAt: "desc" }]
        }
      }
    });
  });

  await revalidateGearDerivedData();

  return NextResponse.json(updated);
}
