import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { buildProjectCatalogEntryKey } from "@/lib/project-catalog";
import { requireSession } from "@/lib/server/auth-guard";
import {
  PROJECT_CATALOG_TAG,
  compareProjectCatalogItems,
  getCachedProjectCatalogEntries
} from "@/lib/server/reference-data";
import { z } from "zod";

const imageUrlSchema = z
  .string()
  .max(2000)
  .refine((value) => !value || value.startsWith("/") || /^https?:\/\//i.test(value), {
    message: "图片地址需为 http(s) URL 或站内 / 路径"
  });

const projectCatalogOverrideSchema = z.object({
  entryKey: z.string().min(1),
  name: z.string().min(1).max(120),
  brandName: z.string().min(1).max(60),
  modelCode: z.string().max(80).optional().nullable(),
  categoryName: z.string().min(1).max(40),
  suggestedUnitPriceCny: z.number().min(0).optional().nullable(),
  popularity: z.number().int().min(0).max(999),
  imageUrl: imageUrlSchema.optional().nullable().or(z.literal("")),
  tags: z.array(z.string().min(1).max(30)).max(12).default([])
});

function matchesQuery(item: { name: string; brandName: string; modelCode?: string; categoryName: string; tags?: string[] }, query: string) {
  if (!query) return true;
  const haystack = [item.name, item.brandName, item.modelCode ?? "", item.categoryName, ...(item.tags ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const categoryName = (request.nextUrl.searchParams.get("categoryName") ?? "").trim();

  const items = (await getCachedProjectCatalogEntries())
    .filter((item) => (!categoryName || item.categoryName === categoryName) && matchesQuery(item, query))
    .sort(compareProjectCatalogItems);

  return NextResponse.json({ items });
}

export async function PUT(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = projectCatalogOverrideSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const input = parsed.data;
  const nextEntryKey = buildProjectCatalogEntryKey({
    name: input.name,
    brandName: input.brandName,
    modelCode: input.modelCode ?? "",
    categoryName: input.categoryName
  });

  try {
    const saved = await prisma.$transaction(async (tx) => {
      if (input.entryKey !== nextEntryKey) {
        const conflict = await tx.projectCatalogOverride.findUnique({
          where: { entryKey: nextEntryKey },
          select: { id: true }
        });
        if (conflict) {
          throw new Error("ENTRY_KEY_CONFLICT");
        }
      }

      const upserted = await tx.projectCatalogOverride.upsert({
        where: { entryKey: nextEntryKey },
        update: {
          name: input.name,
          brandName: input.brandName,
          modelCode: input.modelCode ?? null,
          categoryName: input.categoryName,
          suggestedUnitPriceCny:
            input.suggestedUnitPriceCny == null ? null : new Prisma.Decimal(input.suggestedUnitPriceCny),
          popularity: input.popularity,
          imageUrl: input.imageUrl || null,
          tagsJson: input.tags
        },
        create: {
          entryKey: nextEntryKey,
          name: input.name,
          brandName: input.brandName,
          modelCode: input.modelCode ?? null,
          categoryName: input.categoryName,
          suggestedUnitPriceCny:
            input.suggestedUnitPriceCny == null ? null : new Prisma.Decimal(input.suggestedUnitPriceCny),
          popularity: input.popularity,
          imageUrl: input.imageUrl || null,
          tagsJson: input.tags
        }
      });

      if (input.entryKey !== nextEntryKey) {
        await tx.projectCatalogOverride.deleteMany({
          where: {
            entryKey: input.entryKey
          }
        });
      }

      return upserted;
    });

    revalidateTag(PROJECT_CATALOG_TAG);

    return NextResponse.json(saved);
  } catch (error) {
    if ((error as Error).message === "ENTRY_KEY_CONFLICT") {
      return NextResponse.json({ error: "目标条目已存在，请先合并后再修改。" }, { status: 409 });
    }
    return NextResponse.json(
      { error: "保存项目装备库失败", detail: (error as Error).message },
      { status: 500 }
    );
  }
}
