import type { ProjectCatalogOverride } from "@prisma/client";

import { canonicalProductName } from "@/lib/business-rules";
import { PROJECT_GEAR_CATALOG } from "@/lib/data/project-gear-catalog";
import type { HotGearSeed } from "@/lib/data/hot-gear-catalog";

export type ProjectCatalogEntry = HotGearSeed & {
  entryKey: string;
  overridden?: boolean;
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function buildLooseProjectCatalogKey(input: {
  brandName?: string | null;
  modelCode?: string | null;
  categoryName?: string | null;
}) {
  return [
    normalize(input.brandName ?? ""),
    normalize(input.modelCode ?? ""),
    normalize(input.categoryName ?? "")
  ].join("|");
}

export function buildProjectCatalogEntryKey(input: {
  name: string;
  brandName?: string | null;
  modelCode?: string | null;
  categoryName?: string | null;
}) {
  const canonicalName = canonicalProductName({
    name: input.name,
    brandName: input.brandName ?? "",
    modelCode: input.modelCode ?? "",
    categoryName: input.categoryName ?? ""
  });

  return [
    normalize(canonicalName),
    normalize(input.brandName ?? ""),
    normalize(input.modelCode ?? ""),
    normalize(input.categoryName ?? "")
  ].join("|");
}

function fromOverride(override: ProjectCatalogOverride): ProjectCatalogEntry {
  const tags = Array.isArray(override.tagsJson)
    ? override.tagsJson.filter((item): item is string => typeof item === "string")
    : [];

  return {
    entryKey: override.entryKey,
    name: override.name,
    brandName: override.brandName,
    modelCode: override.modelCode ?? undefined,
    categoryName: override.categoryName,
    suggestedUnitPriceCny:
      override.suggestedUnitPriceCny == null ? undefined : Number(override.suggestedUnitPriceCny),
    popularity: override.popularity,
    imageUrl: override.imageUrl ?? undefined,
    tags,
    overridden: true
  };
}

function mergeBaseEntryWithOverride(
  base: HotGearSeed,
  entryKey: string,
  override: ProjectCatalogOverride
): ProjectCatalogEntry {
  const tags = Array.isArray(override.tagsJson)
    ? override.tagsJson.filter((item): item is string => typeof item === "string")
    : [];

  return {
    ...base,
    entryKey,
    suggestedUnitPriceCny:
      override.suggestedUnitPriceCny == null
        ? base.suggestedUnitPriceCny
        : Number(override.suggestedUnitPriceCny),
    imageUrl: override.imageUrl ?? base.imageUrl,
    tags: tags.length ? tags : base.tags,
    overridden: true
  };
}

export function buildProjectCatalogEntries(overrides: ProjectCatalogOverride[] = []): ProjectCatalogEntry[] {
  const overrideMap = new Map(overrides.map((item) => [item.entryKey, item]));
  const looseOverrideMap = new Map<string, ProjectCatalogOverride>();
  const mergedOverrideEntryKeys = new Set<string>();

  for (const item of overrides) {
    const looseKey = buildLooseProjectCatalogKey(item);
    if (!looseKey || looseOverrideMap.has(looseKey)) continue;
    looseOverrideMap.set(looseKey, item);
  }

  const baseEntries = PROJECT_GEAR_CATALOG.map((item) => {
    const entryKey = buildProjectCatalogEntryKey(item);
    const looseKey = buildLooseProjectCatalogKey(item);
    const exactOverride = overrideMap.get(entryKey);
    const looseOverride = exactOverride ? null : looseOverrideMap.get(looseKey);
    const override = exactOverride ?? looseOverride;

    if (!override) {
      return {
        ...item,
        entryKey,
        overridden: false
      };
    }

    mergedOverrideEntryKeys.add(override.entryKey);

    if (exactOverride) {
      return fromOverride(exactOverride);
    }

    return mergeBaseEntryWithOverride(item, entryKey, override);
  });

  const extraEntries = overrides
    .filter((item) => !mergedOverrideEntryKeys.has(item.entryKey))
    .map((item) => fromOverride(item));

  return [...baseEntries, ...extraEntries];
}
