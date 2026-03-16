"use client";

import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import {
  canonicalOptionalBrandDisplayName,
  canonicalProductName
} from "@/lib/business-rules";
import { currency, dateText } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
};

type PurchaseView = {
  id: string;
  categoryId: string;
  purchaseDate: string;
  itemNameSnapshot: string;
  itemStatus: "IN_USE" | "USED_UP" | "WORN_OUT" | "STORED";
  unitPriceCny: number;
  quantity: number;
  totalPriceCny: number;
  channel: string;
  notes: string;
  isSecondHand: boolean;
  brand?: { name: string } | null;
  gearItem?: { modelCode?: string | null } | null;
  category?: { name: string } | null;
};

type GearDetailData = {
  id: string;
  name: string;
  brandName: string;
  categoryId: string;
  modelCode: string;
  coverImageUrl: string;
  notes: string;
  createdAt: string;
  events: Array<{
    id: string;
    eventType: "PURCHASED" | "CONSUMED" | "DAMAGED" | "STATUS_CHANGED";
    quantityDelta: number;
    fromStatus?: "IN_USE" | "USED_UP" | "WORN_OUT" | "STORED" | null;
    toStatus?: "IN_USE" | "USED_UP" | "WORN_OUT" | "STORED" | null;
    eventAt: string;
    notes: string;
    itemNameSnapshot: string;
  }>;
  purchases: PurchaseView[];
};

const STATUS_LABELS: Record<PurchaseView["itemStatus"], string> = {
  IN_USE: "在用",
  USED_UP: "用完",
  WORN_OUT: "损坏",
  STORED: "闲置"
};

const EVENT_LABELS: Record<GearDetailData["events"][number]["eventType"], string> = {
  PURCHASED: "买入",
  CONSUMED: "用完",
  DAMAGED: "损坏",
  STATUS_CHANGED: "状态变更"
};

function eventAccentClass(eventType: GearDetailData["events"][number]["eventType"]) {
  if (eventType === "PURCHASED") return "bg-accent";
  if (eventType === "CONSUMED") return "bg-warning";
  if (eventType === "DAMAGED") return "bg-danger";
  return "bg-text-mute";
}

function displayPurchaseName(item: Pick<PurchaseView, "itemNameSnapshot" | "category" | "gearItem" | "brand">) {
  return canonicalProductName({
    name: item.itemNameSnapshot,
    brandName: item.brand?.name ?? "",
    modelCode: item.gearItem?.modelCode ?? "",
    categoryName: item.category?.name ?? ""
  });
}

function displayEventName(event: GearDetailData["events"][number]) {
  return canonicalProductName({
    name: event.itemNameSnapshot
  });
}

function summaryValue(purchases: PurchaseView[]) {
  return purchases.reduce((sum, item) => sum + item.totalPriceCny, 0);
}

export function GearDetailEditor({
  initialData,
  categories
}: {
  initialData: GearDetailData;
  categories: Category[];
}) {
  const categoryName = categories.find((item) => item.id === initialData.categoryId)?.name ?? "未分类";
  const brandName = canonicalOptionalBrandDisplayName(initialData.brandName) || "未知品牌";
  const totalSpent = summaryValue(initialData.purchases);
  const activeCount = initialData.purchases.filter(
    (item) => item.itemStatus === "IN_USE" || item.itemStatus === "STORED"
  ).length;

  return (
    <div className="space-y-6">
      <SectionTitle title={initialData.name} subtitle={`${brandName} · ${categoryName}`} />

      <Card entryAnimation={false}>
        <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[28px] border border-border bg-panel-2 p-4">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] border border-border bg-panel">
              {initialData.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={initialData.coverImageUrl}
                  alt={initialData.name}
                  className="h-full w-full object-contain p-4"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.24em] text-text-mute">
                  no preview
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[24px] border border-border bg-panel-2 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-mute">型号</div>
                <div className="mt-2 text-base font-medium text-text">{initialData.modelCode || "-"}</div>
              </div>
              <div className="rounded-[24px] border border-border bg-panel-2 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-mute">购买记录</div>
                <div className="mt-2 text-base font-medium text-text">{initialData.purchases.length} 条</div>
              </div>
              <div className="rounded-[24px] border border-border bg-panel-2 px-4 py-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-mute">当前活跃</div>
                <div className="mt-2 text-base font-medium text-text">{activeCount} 条</div>
              </div>
            </div>

            <div className="rounded-[24px] border border-border bg-panel-2 px-4 py-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-mute">档案摘要</div>
                  <div className="mt-2 text-sm leading-7 text-text-mute">
                    这里不再承担装备信息编辑，只保留你最需要回看的生命周期变化与购买记录。
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-mute">累计投入</div>
                  <div className="mt-2 text-2xl font-semibold text-text">{currency(totalSpent)}</div>
                </div>
              </div>
              {initialData.notes ? (
                <p className="mt-4 border-t border-border/80 pt-4 text-sm leading-7 text-text-mute">
                  {initialData.notes}
                </p>
              ) : null}
              <p className="mt-4 text-xs text-mute">建档时间：{dateText(initialData.createdAt)}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card entryAnimation={false}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-neon">生命周期时间线</h2>
            <p className="mt-2 text-sm text-text-mute">按时间回看这件装备经历过的购入、消耗、损坏和状态变化。</p>
          </div>
          <span className="rounded-full border border-border bg-panel-2 px-3 py-1 text-xs text-text-mute">
            {initialData.events.length} 条事件
          </span>
        </div>

        <div className="space-y-5">
          {initialData.events.map((event, index) => (
            <div key={event.id} className="relative pl-8">
              {index < initialData.events.length - 1 ? (
                <div className="absolute left-[11px] top-7 h-[calc(100%+1.25rem)] w-px bg-border" />
              ) : null}
              <div className={`absolute left-0 top-1.5 h-6 w-6 rounded-full border border-white/40 ${eventAccentClass(event.eventType)}`} />
              <div className="rounded-[24px] border border-border bg-panel-2 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-base text-text">{EVENT_LABELS[event.eventType]}</span>
                    {event.quantityDelta !== 0 ? (
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs text-text-mute">
                        {event.quantityDelta > 0 ? `+${event.quantityDelta}` : event.quantityDelta}
                      </span>
                    ) : null}
                    {event.fromStatus || event.toStatus ? (
                      <span className="text-xs text-text-mute">
                        {(event.fromStatus ? STATUS_LABELS[event.fromStatus] : "未记录") +
                          " → " +
                          (event.toStatus ? STATUS_LABELS[event.toStatus] : "未记录")}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-text-mute">{dateText(event.eventAt)}</span>
                </div>
                {event.itemNameSnapshot ? (
                  <div className="mt-2 text-sm font-medium text-text">{displayEventName(event)}</div>
                ) : null}
                {event.notes ? <div className="mt-2 text-sm leading-6 text-text-mute">{event.notes}</div> : null}
              </div>
            </div>
          ))}
          {!initialData.events.length ? <p className="text-sm text-mute">暂无生命周期记录</p> : null}
        </div>
      </Card>

      <Card entryAnimation={false}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-neon">购买记录</h2>
            <p className="mt-2 text-sm text-text-mute">保留每次入手的价格、数量、渠道与状态，方便和时间线一起回看。</p>
          </div>
          <Link href="/purchases/ledger" className="text-sm text-accent underline-offset-2 hover:underline">
            前往购买台账
          </Link>
        </div>

        <div className="space-y-3">
          {initialData.purchases.map((purchase) => (
            <div key={purchase.id} className="rounded-[24px] border border-border bg-panel-2 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-text">{displayPurchaseName(purchase)}</div>
                  <div className="mt-1 text-xs text-text-mute">
                    {canonicalOptionalBrandDisplayName(purchase.brand?.name) || "未知品牌"} ·{" "}
                    {purchase.gearItem?.modelCode || "无型号"} · {purchase.category?.name || "未分类"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-mute">{dateText(purchase.purchaseDate)}</div>
                  <div className="mt-1 text-base font-semibold text-text">{currency(purchase.totalPriceCny)}</div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-mute">
                <span className="rounded-full border border-border px-2.5 py-1">{STATUS_LABELS[purchase.itemStatus]}</span>
                <span className="rounded-full border border-border px-2.5 py-1">数量 {purchase.quantity}</span>
                <span className="rounded-full border border-border px-2.5 py-1">单价 {currency(purchase.unitPriceCny)}</span>
                {purchase.channel ? <span className="rounded-full border border-border px-2.5 py-1">{purchase.channel}</span> : null}
                {purchase.isSecondHand ? <span className="rounded-full border border-border px-2.5 py-1">二手</span> : null}
              </div>

              {purchase.notes ? <p className="mt-3 text-sm leading-6 text-text-mute">{purchase.notes}</p> : null}
            </div>
          ))}
          {!initialData.purchases.length ? <p className="text-sm text-mute">暂无关联购买记录</p> : null}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/gear-wall" className="text-sm text-accent underline-offset-2 hover:underline">
          返回装备墙
        </Link>
        <Link href="/purchases/ledger" className="text-sm text-accent underline-offset-2 hover:underline">
          查看全部购买台账
        </Link>
      </div>
    </div>
  );
}
