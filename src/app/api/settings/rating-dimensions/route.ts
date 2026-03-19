import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { getCachedRatingDimensions, RATING_DIMENSIONS_TAG } from "@/lib/server/reference-data";

const updateSchema = z.object({
  items: z.array(
    z.object({
      key: z.string().min(1),
      label: z.string().min(1).max(20),
      weight: z.number().nonnegative(),
      sortOrder: z.number().int().min(0),
      isActive: z.boolean().default(true)
    })
  )
});

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const items = await getCachedRatingDimensions();

  return NextResponse.json({ items });
}

export async function PUT(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await prisma.$transaction(
    parsed.data.items.map((item) =>
      prisma.ratingDimension.upsert({
        where: { key: item.key },
        update: {
          label: item.label,
          weight: new Prisma.Decimal(item.weight),
          sortOrder: item.sortOrder,
          isActive: item.isActive
        },
        create: {
          key: item.key,
          label: item.label,
          weight: new Prisma.Decimal(item.weight),
          sortOrder: item.sortOrder,
          isActive: item.isActive
        }
      })
    )
  );

  revalidateTag(RATING_DIMENSIONS_TAG);

  return NextResponse.json({ items: result });
}
