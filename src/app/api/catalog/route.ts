import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { canonicalProductKey, canonicalProductName } from "@/lib/business-rules";
import { HOT_GEAR_CATALOG } from "@/lib/data/hot-gear-catalog";
import { buildProjectCatalogEntries } from "@/lib/project-catalog";

type CatalogItem = {
  id: string;
  source: "HOT" | "HISTORY" | "PROJECT";
  name: string;
  brandName: string;
  modelCode: string;
  categoryId: string;
  categoryName: string;
  suggestedUnitPriceCny: number | null;
  imageUrl: string | null;
  hotRank: number | null;
  historyCount: number;
  lastPurchasedAt: string | null;
  tags: string[];
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function itemKey(input: { name: string; brandName?: string; modelCode?: string; categoryId?: string }) {
  const canonicalName = canonicalProductName({
    name: input.name,
    brandName: input.brandName,
    modelCode: input.modelCode
  });
  return [
    normalize(canonicalName),
    normalize(input.brandName ?? ""),
    normalize(input.modelCode ?? ""),
    normalize(input.categoryId ?? "")
  ].join("|");
}

function byScore(a: CatalogItem, b: CatalogItem) {
  const aScore = (a.hotRank ? 500 - a.hotRank : 0) + a.historyCount * 12;
  const bScore = (b.hotRank ? 500 - b.hotRank : 0) + b.historyCount * 12;
  if (aScore !== bScore) return bScore - aScore;
  const aDate = a.lastPurchasedAt ? new Date(a.lastPurchasedAt).getTime() : 0;
  const bDate = b.lastPurchasedAt ? new Date(b.lastPurchasedAt).getTime() : 0;
  if (aDate !== bDate) return bDate - aDate;
  return a.name.localeCompare(b.name, "zh-Hans-CN");
}

function byProjectRank(a: CatalogItem, b: CatalogItem) {
  const collator = new Intl.Collator("zh-Hans-CN");
  const brandDiff = collator.compare(a.brandName || "", b.brandName || "");
  if (brandDiff !== 0) return brandDiff;
  const aPrice = typeof a.suggestedUnitPriceCny === "number" ? a.suggestedUnitPriceCny : Number.POSITIVE_INFINITY;
  const bPrice = typeof b.suggestedUnitPriceCny === "number" ? b.suggestedUnitPriceCny : Number.POSITIVE_INFINITY;
  if (aPrice !== bPrice) return aPrice - bPrice;
  const modelDiff = collator.compare(a.modelCode || "", b.modelCode || "");
  if (modelDiff !== 0) return modelDiff;
  return collator.compare(a.name, b.name);
}

function filterByQueryAndCategory(items: CatalogItem[], query: string, categoryIdFilter: string) {
  const queryLower = query.toLowerCase();
  return items.filter((item) => {
    if (categoryIdFilter && item.categoryId !== categoryIdFilter) return false;
    if (!queryLower) return true;
    const haystack = [
      item.name,
      item.brandName,
      item.modelCode,
      item.categoryName,
      ...(item.tags ?? [])
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(queryLower);
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { searchParams } = request.nextUrl;
  const scope = (searchParams.get("scope") ?? "mix").trim().toLowerCase();
  const query = (searchParams.get("q") ?? "").trim();
  const categoryIdFilter = (searchParams.get("categoryId") ?? "").trim();
  const limit = Math.min(3000, Math.max(8, Number(searchParams.get("limit") ?? "24")));

  const categories = await prisma.category.findMany({
    select: { id: true, name: true }
  });
  const categoryByName = new Map(categories.map((item) => [item.name, item.id]));
  const categoryById = new Map(categories.map((item) => [item.id, item.name]));

  const overrides = await prisma.projectCatalogOverride.findMany();
  const projectItems: CatalogItem[] = buildProjectCatalogEntries(overrides).map((item) => {
    const categoryId = categoryByName.get(item.categoryName) ?? "";
    return {
      id: `project:${item.entryKey}`,
      source: "PROJECT",
      name: item.name,
      brandName: item.brandName,
      modelCode: item.modelCode ?? "",
      categoryId,
      categoryName: item.categoryName,
      suggestedUnitPriceCny: item.suggestedUnitPriceCny ?? null,
      imageUrl: item.imageUrl ?? null,
      hotRank: item.popularity,
      historyCount: 0,
      lastPurchasedAt: null,
      tags: item.tags ?? []
    };
  });

  if (scope === "project") {
    const projectFiltered = filterByQueryAndCategory(projectItems, query, categoryIdFilter).sort(byProjectRank);
    return NextResponse.json({
      items: projectFiltered.slice(0, limit),
      total: projectFiltered.length
    });
  }

  const hotItems: CatalogItem[] = HOT_GEAR_CATALOG.map((item) => {
    const categoryId = categoryByName.get(item.categoryName) ?? "";
    return {
      id: `hot:${itemKey({ name: item.name, brandName: item.brandName, modelCode: item.modelCode, categoryId })}`,
      source: "HOT",
      name: item.name,
      brandName: item.brandName,
      modelCode: item.modelCode ?? "",
      categoryId,
      categoryName: item.categoryName,
      suggestedUnitPriceCny: item.suggestedUnitPriceCny ?? null,
      imageUrl: item.imageUrl ?? null,
      hotRank: item.popularity,
      historyCount: 0,
      lastPurchasedAt: null,
      tags: item.tags ?? []
    };
  });

  const latestPurchases = await prisma.purchaseRecord.findMany({
    select: {
      id: true,
      itemNameSnapshot: true,
      purchaseDate: true,
      unitPriceCny: true,
      categoryId: true,
      brand: { select: { name: true } },
      category: { select: { name: true } },
      gearItem: { select: { modelCode: true, coverImageUrl: true } }
    },
    orderBy: { purchaseDate: "desc" },
    take: 400
  });

  const historyMap = new Map<string, CatalogItem>();
  for (const row of latestPurchases) {
    const key = itemKey({
      name: canonicalProductName({
        name: row.itemNameSnapshot,
        brandName: row.brand?.name ?? "",
        modelCode: row.gearItem?.modelCode ?? ""
      }),
      brandName: row.brand?.name ?? "",
      modelCode: row.gearItem?.modelCode ?? "",
      categoryId: row.categoryId ?? ""
    });

    const found = historyMap.get(key);
    if (!found) {
      historyMap.set(key, {
        id: `history:${key}`,
        source: "HISTORY",
        name: canonicalProductName({
          name: row.itemNameSnapshot,
          brandName: row.brand?.name ?? "",
          modelCode: row.gearItem?.modelCode ?? ""
        }),
        brandName: row.brand?.name ?? "",
        modelCode: row.gearItem?.modelCode ?? "",
        categoryId: row.categoryId ?? "",
        categoryName: row.category?.name ?? (row.categoryId ? categoryById.get(row.categoryId) ?? "未分类" : "未分类"),
        suggestedUnitPriceCny: Number(row.unitPriceCny),
        imageUrl: row.gearItem?.coverImageUrl ?? null,
        hotRank: null,
        historyCount: 1,
        lastPurchasedAt: row.purchaseDate.toISOString(),
        tags: ["历史购买"]
      });
      continue;
    }

    found.historyCount += 1;
    if (!found.lastPurchasedAt || row.purchaseDate.getTime() > new Date(found.lastPurchasedAt).getTime()) {
      found.lastPurchasedAt = row.purchaseDate.toISOString();
      found.suggestedUnitPriceCny = Number(row.unitPriceCny);
    }
  }

  const merged = new Map<string, CatalogItem>();
  const mixBase =
    query
      ? [...hotItems, ...historyMap.values(), ...projectItems]
      : [...hotItems, ...historyMap.values()];
  for (const item of mixBase) {
    const key = itemKey({
      name: item.name,
      brandName: item.brandName,
      modelCode: item.modelCode,
      categoryId: item.categoryId
    });
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, item);
      continue;
    }
    merged.set(key, {
      ...existing,
      source:
        existing.source === "HOT" || item.source === "HOT"
          ? "HOT"
          : existing.source === "HISTORY" || item.source === "HISTORY"
            ? "HISTORY"
            : "PROJECT",
      suggestedUnitPriceCny: existing.suggestedUnitPriceCny ?? item.suggestedUnitPriceCny,
      imageUrl: existing.imageUrl ?? item.imageUrl,
      hotRank: existing.hotRank ?? item.hotRank,
      historyCount: Math.max(existing.historyCount, item.historyCount),
      lastPurchasedAt:
        existing.lastPurchasedAt && item.lastPurchasedAt
          ? (new Date(existing.lastPurchasedAt).getTime() >= new Date(item.lastPurchasedAt).getTime()
            ? existing.lastPurchasedAt
            : item.lastPurchasedAt)
          : existing.lastPurchasedAt ?? item.lastPurchasedAt,
      tags: [...new Set([...(existing.tags ?? []), ...(item.tags ?? [])])]
    });
  }

  const filtered = filterByQueryAndCategory([...merged.values()], query, categoryIdFilter);

  filtered.sort(byScore);
  return NextResponse.json({
    items: filtered.slice(0, limit),
    total: filtered.length
  });
}
