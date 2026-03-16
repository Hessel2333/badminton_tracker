"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { GalleryHorizontal, Grid } from "lucide-react";

import type { GearWallItem } from "@/components/forms/gear-wall-types";
import { SectionTitle } from "@/components/ui/SectionTitle";

const GearWallManager = dynamic(
  () => import("@/components/forms/GearWallManager").then((mod) => mod.GearWallManager),
  {
    ssr: false,
    loading: () => <div className="rounded-[28px] border border-border bg-panel/70 p-8 text-sm text-text-mute">加载资产盘点中...</div>
  }
);

const GearPegboardManager = dynamic(
  () => import("@/components/forms/GearPegboardManager").then((mod) => mod.GearPegboardManager),
  {
    ssr: false,
    loading: () => <div className="rounded-[28px] border border-border bg-panel/70 p-8 text-sm text-text-mute">加载展陈视图中...</div>
  }
);

type ArchiveView = "status" | "display";

const tabConfig: Record<
  ArchiveView,
  {
    href: string;
    label: string;
    title: string;
    subtitle: string;
    icon: typeof Grid;
  }
> = {
  status: {
    href: "/gear-wall",
    label: "资产盘点",
    title: "档案陈列",
    subtitle: "先盘点你当前拥有什么、各自是什么状态，再决定是否切到展陈视图。",
    icon: Grid
  },
  display: {
    href: "/gear-board",
    label: "展陈视图",
    title: "档案陈列",
    subtitle: "同一批装备切到展示模式，专注观察陈列关系、布局和导出画面。",
    icon: GalleryHorizontal
  }
};

export function ArchiveWorkspace({
  initialItems,
  view
}: {
  initialItems: GearWallItem[];
  view: ArchiveView;
}) {
  const current = tabConfig[view];

  return (
    <div className="space-y-6">
      <SectionTitle icon={current.icon} title={current.title} subtitle={current.subtitle} />

      <div className="flex flex-wrap gap-3">
        {(
          [
            ["status", tabConfig.status],
            ["display", tabConfig.display]
          ] as const
        ).map(([key, item]) => {
          const active = key === view;
          return (
            <Link
              key={key}
              href={item.href}
              className={[
                "inline-flex min-h-11 items-center justify-center rounded-full border px-5 text-sm font-medium transition-all duration-200",
                active
                  ? "border-[color:color-mix(in_srgb,var(--accent)_20%,var(--border))] bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--panel-2))] text-[color:color-mix(in_srgb,var(--accent)_76%,var(--text)_24%)] shadow-[inset_0_1px_0_var(--glass-border)]"
                  : "border-[var(--border)] bg-[color:var(--panel-2)] text-text-mute shadow-[inset_0_1px_0_var(--glass-border)] hover:border-[var(--border-strong)] hover:text-text"
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      {view === "status" ? (
        <GearWallManager initialItems={initialItems} />
      ) : (
        <GearPegboardManager initialItems={initialItems} />
      )}
    </div>
  );
}
