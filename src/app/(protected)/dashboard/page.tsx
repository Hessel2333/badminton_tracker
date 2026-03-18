import Link from "next/link";
import { ItemStatus } from "@prisma/client";
import { ArrowRight, BarChart3, GalleryHorizontal, Grid, Layout, Package2 } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { SmartImage } from "@/components/ui/SmartImage";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { currency, dateText } from "@/lib/utils";
import { getOverview } from "@/lib/analytics/queries";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";

export const revalidate = 60;

const statusMeta = {
  active: {
    label: "在用",
    countLabel: "支 / 双 / 桶",
    tone: "bg-[color:color-mix(in_srgb,var(--accent)_10%,var(--panel-2))] text-[color:color-mix(in_srgb,var(--accent)_72%,var(--text)_28%)]"
  },
  stored: {
    label: "闲置",
    countLabel: "件待命",
    tone: "bg-[color:color-mix(in_srgb,var(--accent)_6%,var(--panel-2))] text-[color:color-mix(in_srgb,var(--text)_84%,var(--text-mute)_16%)]"
  },
  retired: {
    label: "已退役 / 已用完",
    countLabel: "件归档",
    tone: "bg-[color:color-mix(in_srgb,var(--text)_7%,var(--panel-2))] text-[color:color-mix(in_srgb,var(--text)_82%,var(--text-mute)_18%)]"
  }
} as const;

const moduleLinks = [
  {
    href: "/gear-wall",
    title: "装备墙",
    summary: "先看你现在拥有什么、各自是什么状态。",
    icon: Grid
  },
  {
    href: "/gear-board",
    title: "洞洞板",
    summary: "把同一批装备切换到更偏陈列与偏好的观察方式。",
    icon: GalleryHorizontal
  },
  {
    href: "/analytics",
    title: "分析看板",
    summary: "当你要判断下一次该买什么时，再去看趋势和占比。",
    icon: BarChart3
  }
];

function statusBadge(status: ItemStatus) {
  switch (status) {
    case ItemStatus.IN_USE:
      return { label: "在用", tone: statusMeta.active.tone };
    case ItemStatus.STORED:
      return { label: "闲置", tone: statusMeta.stored.tone };
    case ItemStatus.USED_UP:
      return { label: "已用完", tone: statusMeta.retired.tone };
    case ItemStatus.WORN_OUT:
      return { label: "已退役", tone: statusMeta.retired.tone };
    default:
      return { label: "未知", tone: statusMeta.stored.tone };
  }
}

export default async function DashboardPage() {
  const [overview, groupedStatus, recentArchive] = await Promise.all([
    getOverview(),
    prisma.purchaseRecord.groupBy({
      by: ["itemStatus"],
      _sum: { quantity: true }
    }),
    prisma.purchaseRecord.findMany({
      take: 5,
      orderBy: { purchaseDate: "desc" },
      include: {
        brand: true,
        category: true,
        gearItem: {
          select: {
            coverImageUrl: true
          }
        }
      }
    })
  ]);

  const quantityByStatus = new Map(
    groupedStatus.map((item) => [item.itemStatus, item._sum.quantity ?? 0])
  );

  const archiveState = [
    {
      key: "active",
      quantity: (quantityByStatus.get(ItemStatus.IN_USE) ?? 0),
      description: "当前正在打和正在消耗的装备。"
    },
    {
      key: "stored",
      quantity: quantityByStatus.get(ItemStatus.STORED) ?? 0,
      description: "已经入档，但暂时没有投入使用。"
    },
    {
      key: "retired",
      quantity:
        (quantityByStatus.get(ItemStatus.USED_UP) ?? 0) +
        (quantityByStatus.get(ItemStatus.WORN_OUT) ?? 0),
      description: "完成生命周期、可以回看取舍记录。"
    }
  ] as const;

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Layout}
        title="档案状态"
        subtitle="先看你当前的装备状态，再决定是继续整理陈列，还是转去做分析判断。"
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-mute">
                Current Archive
              </p>
              <h2 className="mt-2 font-display text-[1.9rem] tracking-[-0.05em] text-text">
                你的羽球档案现在是什么状态
              </h2>
            </div>
            <div className="rounded-full border border-[var(--border)] bg-[color:var(--panel-2)] px-4 py-2 text-xs text-text-mute shadow-[inset_0_1px_0_var(--glass-border)]">
              最近记录 {overview.recentPurchases.length} 条
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {archiveState.map((item) => {
              const meta = statusMeta[item.key];
              return (
                <div
                  key={item.key}
                  className="rounded-[24px] border border-[color:color-mix(in_srgb,var(--accent)_10%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_82%,white)] p-5"
                >
                  <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${meta.tone}`}>
                    {meta.label}
                  </div>
                  <div className="mt-4 font-display text-[2.5rem] leading-none tracking-[-0.07em] text-text">
                    {item.quantity}
                  </div>
                  <div className="mt-2 text-xs leading-6 text-text-mute">{meta.countLabel}</div>
                  <p className="mt-4 text-sm leading-7 text-[color:color-mix(in_srgb,var(--text)_84%,var(--text-mute)_16%)]">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 border-t border-[var(--border)] pt-5 md:grid-cols-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-mute">本月投入</div>
              <div className="mt-2 font-display text-[1.6rem] tracking-[-0.05em] text-text">
                {currency(overview.currentMonthSpend)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-mute">累计投入</div>
              <div className="mt-2 font-display text-[1.6rem] tracking-[-0.05em] text-text">
                {currency(overview.totalSpend)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-mute">心愿单目标额</div>
              <div className="mt-2 font-display text-[1.6rem] tracking-[-0.05em] text-text">
                {currency(overview.wishlistTargetAmount)}
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="border-b border-[var(--border)] pb-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-mute">
              Continue With
            </p>
            <h2 className="mt-2 font-display text-[1.6rem] tracking-[-0.05em] text-text">
              接下来去哪里
            </h2>
          </div>

          <div className="space-y-3">
            {moduleLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-[22px] border border-[color:color-mix(in_srgb,var(--accent)_10%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_80%,white)] px-4 py-4 transition-all duration-200 hover:border-[color:color-mix(in_srgb,var(--accent)_18%,var(--border))] hover:bg-[color:color-mix(in_srgb,var(--panel-3)_92%,white)]"
                >
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[color:color-mix(in_srgb,var(--accent)_9%,var(--panel-2))] text-[color:color-mix(in_srgb,var(--accent)_72%,var(--text)_28%)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-medium text-text">{item.title}</h3>
                      <ArrowRight className="h-4 w-4 text-text-mute transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-text" />
                    </div>
                    <p className="mt-1.5 text-sm leading-7 text-text-mute">{item.summary}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-text-mute">
              Recent Archive Changes
            </p>
            <h2 className="mt-2 font-display text-[1.55rem] tracking-[-0.05em] text-text">
              最近入档与状态变化
            </h2>
          </div>
          <Link
            href="/gear-wall"
            className="text-sm font-medium text-[color:color-mix(in_srgb,var(--accent)_76%,var(--text)_24%)]"
          >
            去装备墙查看全量档案
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {recentArchive.map((item) => {
            const badge = statusBadge(item.itemStatus);
            const imageUrl = item.gearItem?.coverImageUrl || null;
            return (
              <div
                key={item.id}
                className="flex gap-4 rounded-[24px] border border-[color:color-mix(in_srgb,var(--accent)_10%,var(--border))] bg-[color:color-mix(in_srgb,var(--panel-3)_84%,white)] p-4"
              >
                <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[20px] bg-[color:color-mix(in_srgb,var(--panel-2)_96%,white)]">
                  {imageUrl ? (
                    <SmartImage
                      src={imageUrl}
                      alt={item.itemNameSnapshot}
                      fill
                      sizes="96px"
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <Package2 className="h-8 w-8 text-text-mute" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${badge.tone}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-text-mute">{dateText(item.purchaseDate)}</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-base font-medium tracking-[-0.03em] text-text">
                    {item.itemNameSnapshot}
                  </h3>
                  <div className="mt-2 text-sm text-text-mute">
                    {(item.brand?.name ?? "未知品牌")} / {(item.category?.name ?? "未分类")}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <span className="text-text-mute">数量 {item.quantity}</span>
                    <span className="font-medium text-[color:color-mix(in_srgb,var(--accent)_76%,var(--text)_24%)]">
                      {currency(toNumber(item.totalPriceCny))}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {!recentArchive.length ? (
            <div className="rounded-[24px] border border-dashed border-[var(--border-strong)] px-6 py-10 text-sm text-text-mute">
              还没有档案记录。先去“新增购买”录入第一件装备，再回来回看你的状态。
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
