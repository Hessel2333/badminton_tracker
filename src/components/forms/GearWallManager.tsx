"use client";

import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { GalleryHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { GearWallItem } from "@/components/forms/gear-wall-types";

export function GearWallManager({
  initialItems
}: {
  initialItems: GearWallItem[];
}) {
  const router = useRouter();
  const prefetched = useRef<Set<string>>(new Set());

  function prefetchDetail(id: string) {
    const href = `/gear/${id}`;
    if (prefetched.current.has(href)) return;
    prefetched.current.add(href);
    router.prefetch(href);
  }

  if (initialItems.length === 0) {
    return (
      <Card className="py-14 text-center">
        <p className="text-text-mute">还没有已购装备，先去购买记录里新增一条。</p>
        <div className="mt-4">
          <Link href="/purchases">
            <Button>新增购买记录</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-display text-2xl font-bold text-text">方格式装备墙</h2>
          <p className="mt-1 text-sm text-text-mute">用于浏览和编辑装备详情，洞洞板视角在独立页面展示。</p>
        </div>
        <Link href="/gear-board">
          <Button>
            <GalleryHorizontal size={16} className="mr-2" />
            切换到洞洞板视角
          </Button>
        </Link>
      </Card>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {initialItems.map((item, index) => {
          const overall = item.ratings?.[0]?.overall;

          return (
            <Link
              key={item.id}
              href={`/gear/${item.id}`}
              onMouseEnter={() => prefetchDetail(item.id)}
              onFocus={() => prefetchDetail(item.id)}
            >
              <Card className="group h-full p-4 transition-all duration-300 hover:border-accent/35">
                <div className="space-y-4">
                  <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-panel shadow-inner">
                    {item.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.coverImageUrl}
                        alt={item.name}
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
      </section>
    </div>
  );
}

