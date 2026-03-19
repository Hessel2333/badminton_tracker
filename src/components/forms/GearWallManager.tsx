"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SmartImage } from "@/components/ui/SmartImage";
import { ShieldCheck } from "lucide-react";
import type { GearWallItem } from "@/components/forms/gear-wall-types";
import { currency, dateText } from "@/lib/utils";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";

type CategoryFilter = "ALL" | "羽毛球" | "球鞋" | "球拍" | "其他";
type SortOption =
  | "recent_purchase_desc"
  | "rating_desc"
  | "reference_price_desc"
  | "reference_price_asc"
  | "created_at_desc"
  | "created_at_asc"
  | "brand_asc";

const CATEGORY_FILTERS: Array<{ key: CategoryFilter; label: string }> = [
  { key: "ALL", label: "全部" },
  { key: "羽毛球", label: "羽毛球" },
  { key: "球鞋", label: "球鞋" },
  { key: "球拍", label: "球拍" },
  { key: "其他", label: "其他" }
];

const SORT_OPTIONS: Array<{ key: SortOption; label: string }> = [
  { key: "recent_purchase_desc", label: "最近购买优先" },
  { key: "rating_desc", label: "等级（评分）从高到低" },
  { key: "reference_price_desc", label: "参考价格从高到低" },
  { key: "reference_price_asc", label: "参考价格从低到高" },
  { key: "created_at_desc", label: "录入日期从新到旧" },
  { key: "created_at_asc", label: "录入日期从旧到新" },
  { key: "brand_asc", label: "品牌排序（A-Z）" }
];

function resolveCategoryBucket(item: GearWallItem): Exclude<CategoryFilter, "ALL"> {
  const raw = item.category?.name ?? "";
  if (raw.includes("羽毛球")) return "羽毛球";
  if (raw.includes("球鞋")) return "球鞋";
  if (raw.includes("球拍")) return "球拍";
  return "其他";
}

function scoreValue(item: GearWallItem) {
  const score = item.ratings?.[0]?.overall;
  if (score == null) return -1;
  const parsed = Number(score);
  return Number.isFinite(parsed) ? parsed : -1;
}

function timestampOrMin(value?: string | null) {
  if (!value) return Number.MIN_SAFE_INTEGER;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : Number.MIN_SAFE_INTEGER;
}

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ControlPanel } from "@/components/ui/ControlPanel";

const CATEGORY_OPTIONS = CATEGORY_FILTERS.map(f => ({ id: f.key, label: f.label }));

function isCategoryFilter(value: unknown): value is CategoryFilter {
  return typeof value === "string" && CATEGORY_FILTERS.some((item) => item.key === value);
}

export function GearWallManager({
  initialItems
}: {
  initialItems: GearWallItem[];
}) {
  const router = useRouter();
  const prefetched = useRef<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useSessionStorageState<CategoryFilter>(
    "gear-wall-category-filter",
    "ALL",
    isCategoryFilter
  );
  const [sortBy, setSortBy] = useState<SortOption>("recent_purchase_desc");

  function prefetchDetail(id: string) {
    const href = `/gear/${id}`;
    if (prefetched.current.has(href)) return;
    prefetched.current.add(href);
    router.prefetch(href);
  }

  if (initialItems.length === 0) {
    return (
      <Card
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10 text-accent">
          <ShieldCheck size={40} strokeWidth={1.5} />
        </div>
        <h2 className="font-display text-xl font-bold text-text">你的装备墙还空着</h2>
        <p className="mt-2 text-sm text-text-mute max-w-xs mx-auto">
          记录下的不仅仅是羽毛球装备，更是那一次次挥拍的热血与回忆。
        </p>
        <div className="mt-8">
          <Link href="/purchases">
            <Button size="lg" className="rounded-2xl shadow-lg shadow-accent/20">
              去录入第一件装备
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const filteredSortedItems = useMemo(() => {
    const filtered = initialItems.filter((item) => {
      if (categoryFilter === "ALL") return true;
      return resolveCategoryBucket(item) === categoryFilter;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "rating_desc": {
          const diff = scoreValue(b) - scoreValue(a);
          if (diff !== 0) return diff;
          break;
        }
        case "reference_price_desc": {
          const diff = Number(b.referenceUnitPriceCny ?? -1) - Number(a.referenceUnitPriceCny ?? -1);
          if (diff !== 0) return diff;
          break;
        }
        case "reference_price_asc": {
          const av = a.referenceUnitPriceCny == null ? Number.MAX_SAFE_INTEGER : Number(a.referenceUnitPriceCny);
          const bv = b.referenceUnitPriceCny == null ? Number.MAX_SAFE_INTEGER : Number(b.referenceUnitPriceCny);
          const diff = av - bv;
          if (diff !== 0) return diff;
          break;
        }
        case "created_at_desc": {
          const diff = timestampOrMin(b.createdAt) - timestampOrMin(a.createdAt);
          if (diff !== 0) return diff;
          break;
        }
        case "created_at_asc": {
          const diff = timestampOrMin(a.createdAt) - timestampOrMin(b.createdAt);
          if (diff !== 0) return diff;
          break;
        }
        case "brand_asc": {
          const brandDiff = (a.brand?.name ?? "").localeCompare(b.brand?.name ?? "", "zh-Hans-CN");
          if (brandDiff !== 0) return brandDiff;
          const modelDiff = (a.modelCode ?? "").localeCompare(b.modelCode ?? "", "zh-Hans-CN");
          if (modelDiff !== 0) return modelDiff;
          break;
        }
        case "recent_purchase_desc":
        default: {
          const diff = timestampOrMin(b.latestPurchaseDate) - timestampOrMin(a.latestPurchaseDate);
          if (diff !== 0) return diff;
          break;
        }
      }

      const createdDiff = timestampOrMin(b.createdAt) - timestampOrMin(a.createdAt);
      if (createdDiff !== 0) return createdDiff;
      return a.name.localeCompare(b.name, "zh-Hans-CN");
    });

    return sorted;
  }, [categoryFilter, initialItems, sortBy]);

  return (
    <div className="space-y-6">
      <ControlPanel
        right={
          <div className="w-[200px]">
            <Select
              className="!h-9 text-xs"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        }
      >
        <SegmentedControl
          options={CATEGORY_OPTIONS}
          value={categoryFilter}
          onChange={(v) => setCategoryFilter(v as CategoryFilter)}
        />
      </ControlPanel>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSortedItems.map((item, index) => {
          const overall = item.ratings?.[0]?.overall;

          return (
            <Link
              key={item.id}
              href={`/gear/${item.id}`}
              onMouseEnter={() => prefetchDetail(item.id)}
              onFocus={() => prefetchDetail(item.id)}
            >
              <Card
                className="group h-full p-4 transition-all duration-300 hover:border-accent/35"
                transition={{ delay: (index % 6) * 0.05 }}
              >
                <div className="space-y-4">
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-panel shadow-inner">
                    {item.coverImageUrl ? (
                      <SmartImage
                        src={item.coverImageUrl}
                        alt={item.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        priority={index < 4}
                        loading={index < 8 ? "eager" : "lazy"}
                        className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-medium uppercase tracking-widest text-text-mute">
                        No Image
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-bold leading-tight text-text transition-colors group-hover:text-accent">
                        {item.name}
                      </h3>
                      {overall != null ? (
                        <span className="font-display text-xl font-black leading-none text-accent">
                          {Number(overall).toFixed(1)}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm text-text-mute">
                      {item.brand?.name ?? "未知品牌"} · {item.modelCode ?? "标准型号"}
                    </p>

                    <div className="text-xs text-text-mute">
                      参考价 {item.referenceUnitPriceCny != null ? currency(item.referenceUnitPriceCny) : "-"} · 最近购入{" "}
                      {item.latestPurchaseDate ? dateText(item.latestPurchaseDate) : "-"}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <Badge variant="neutral">{item.category?.name ?? "未分类"}</Badge>
                      <Badge variant="neutral">总量 {item.totalQuantity}</Badge>
                      <Badge variant="accent">在用 {item.activeQuantity}</Badge>
                      {item.usedUpQuantity > 0 ? <Badge variant="warning">用完 {item.usedUpQuantity}</Badge> : null}
                      {item.wornOutQuantity > 0 ? <Badge variant="danger">损坏 {item.wornOutQuantity}</Badge> : null}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
        {!filteredSortedItems.length ? (
          <Card className="col-span-full py-10 text-center text-text-mute">当前筛选下没有可展示装备。</Card>
        ) : null}
      </section>
    </div>
  );
}
