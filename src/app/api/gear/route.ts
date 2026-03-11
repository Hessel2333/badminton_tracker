import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { canonicalProductName, computeOverallRating } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { findLocalImageUrl } from "@/lib/server/local-image-library";
import { gearCreateSchema } from "@/lib/validators/gear";

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = gearCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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

  const created = await prisma.$transaction(async (tx) => {
    const gear = await tx.gearItem.create({
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

    if (input.rating) {
      const dimensions = await tx.ratingDimension.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" }
      });

      const weightMap = Object.fromEntries(
        dimensions.map((dim) => [dim.key, Number(dim.weight)])
      ) as Partial<Record<"power" | "control" | "durability" | "comfort" | "value", number>>;

      const overall = computeOverallRating(input.rating, weightMap);
      await tx.gearRating.create({
        data: {
          gearItemId: gear.id,
          power: new Prisma.Decimal(input.rating.power),
          control: new Prisma.Decimal(input.rating.control),
          durability: new Prisma.Decimal(input.rating.durability),
          comfort: new Prisma.Decimal(input.rating.comfort),
          value: new Prisma.Decimal(input.rating.value),
          overall: new Prisma.Decimal(overall),
          reviewText: input.rating.reviewText ?? null
        }
      });
    }

    if (input.externalReviews?.length) {
      await tx.externalReview.createMany({
        data: input.externalReviews.map((item) => ({
          gearItemId: gear.id,
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
          scoreText: item.scoreText ?? null,
          summaryText: item.summaryText ?? null
        }))
      });
    }

    return tx.gearItem.findUnique({
      where: { id: gear.id },
      include: {
        brand: true,
        category: true,
        ratings: { orderBy: { ratedAt: "desc" }, take: 1 },
        externalViews: true
      }
    });
  });

  return NextResponse.json(created, { status: 201 });
}

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const brandId = searchParams.get("brandId") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const q = (searchParams.get("q") ?? "").trim();
  const pageSize = Math.min(2000, Math.max(1, Number(searchParams.get("pageSize") ?? "300")));
  const view = searchParams.get("view") ?? "full";

  const where = {
    brandId,
    categoryId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { modelCode: { contains: q, mode: "insensitive" as const } },
            { brand: { is: { name: { contains: q, mode: "insensitive" as const } } } },
            { category: { is: { name: { contains: q, mode: "insensitive" as const } } } }
          ]
        }
      : {})
  };

  if (view === "picker") {
    const items = await prisma.gearItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        modelCode: true,
        coverImageUrl: true,
        brand: {
          select: {
            name: true
          }
        },
        category: {
          select: {
            id: true,
            name: true
          }
        },
        purchases: {
          select: {
            unitPriceCny: true,
            purchaseDate: true
          },
          orderBy: { purchaseDate: "desc" },
          take: 1
        }
      },
      orderBy: [{ createdAt: "desc" }],
      take: pageSize
    });
    return NextResponse.json({ items });
  }

  const items = await prisma.gearItem.findMany({
    where,
    include: {
      brand: true,
      category: true,
      ratings: {
        orderBy: { ratedAt: "desc" },
        take: 1
      },
      purchases: {
        select: {
          unitPriceCny: true,
          purchaseDate: true
        },
        orderBy: { purchaseDate: "desc" },
        take: 1
      }
    },
    orderBy: [{ createdAt: "desc" }],
    take: pageSize
  });

  return NextResponse.json({ items });
}
