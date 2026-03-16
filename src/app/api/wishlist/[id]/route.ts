import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { canonicalProductName } from "@/lib/business-rules";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { findOrCreateBrandId } from "@/lib/server/brands";
import { wishlistSchema } from "@/lib/validators/wishlist";

type Context = {
  params: Promise<{ id: string }>;
};

export async function PUT(request: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;

  const body = await request.json();
  const parsed = wishlistSchema.safeParse(body);

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
    categoryName: category?.name ?? ""
  });
  const brandId = await findOrCreateBrandId(input.brandName ?? null);

  const item = await prisma.wishlistItem.update({
    where: { id },
    data: {
      name: canonicalName,
      brandId,
      categoryId: input.categoryId ?? null,
      targetPriceCny: input.targetPriceCny != null ? new Prisma.Decimal(input.targetPriceCny) : null,
      currentSeenPriceCny:
        input.currentSeenPriceCny != null ? new Prisma.Decimal(input.currentSeenPriceCny) : null,
      priority: input.priority,
      status: input.status,
      sourceUrl: input.sourceUrl ?? null,
      imageUrl: input.imageUrl ?? null,
      notes: input.notes ?? null
    },
    include: {
      brand: true,
      category: true
    }
  });

  return NextResponse.json(item);
}

export async function DELETE(_: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;

  await prisma.wishlistItem.delete({
    where: { id }
  });

  return NextResponse.json({ ok: true });
}
