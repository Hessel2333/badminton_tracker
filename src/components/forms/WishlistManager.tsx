"use client";

import { useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { currency } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
};

type WishlistStatus = "WANT" | "WATCHING" | "PURCHASED" | "DROPPED";

type WishlistItem = {
  id: string;
  categoryId?: string | null;
  name: string;
  priority: number;
  status: WishlistStatus;
  targetPriceCny?: number | string | null;
  currentSeenPriceCny?: number | string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  brand?: { name: string } | null;
  category?: { name: string } | null;
};

const statusLabel: Record<WishlistStatus, string> = {
  WANT: "想买",
  WATCHING: "观望",
  PURCHASED: "已买",
  DROPPED: "放弃"
};

const statusBadgeVariant: Record<WishlistStatus, "accent" | "success" | "warning" | "danger" | "neutral"> = {
  WANT: "warning",
  WATCHING: "neutral",
  PURCHASED: "accent",
  DROPPED: "danger"
};

const formInit = {
  name: "",
  brandName: "",
  categoryId: "",
  targetPriceCny: "",
  currentSeenPriceCny: "",
  priority: 3,
  status: "WANT" as WishlistStatus,
  sourceUrl: "",
  imageUrl: "",
  notes: ""
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function WishlistManager({
  fallbackWishlist,
  fallbackCategories
}: {
  fallbackWishlist?: WishlistItem[];
  fallbackCategories?: Category[];
} = {}) {
  const [form, setForm] = useState(formInit);
  const [saving, setSaving] = useState(false);
  // 替代 window.prompt：存储「待转购买」的项，并让用户在卡片原位输入价格
  const [convertTarget, setConvertTarget] = useState<{ item: WishlistItem; price: string } | null>(null);

  const { data: wishlistData, mutate: mutateWishlist } =
    useSWR<{ items: WishlistItem[] }>("/api/wishlist", fetcher, {
      fallbackData: fallbackWishlist ? { items: fallbackWishlist } : undefined
    });
  const { data: categoryData } =
    useSWR<{ items: Category[] }>("/api/settings/categories", fetcher, {
      fallbackData: fallbackCategories ? { items: fallbackCategories } : undefined
    });

  const items = wishlistData?.items ?? [];
  const categories = categoryData?.items ?? [];

  async function submit() {
    setSaving(true);
    await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        brandName: form.brandName || null,
        categoryId: form.categoryId || null,
        targetPriceCny: form.targetPriceCny === "" ? null : Number(form.targetPriceCny),
        currentSeenPriceCny:
          form.currentSeenPriceCny === "" ? null : Number(form.currentSeenPriceCny),
        sourceUrl: form.sourceUrl || null,
        imageUrl: form.imageUrl || null,
        notes: form.notes || null
      })
    });
    setForm(formInit);
    setSaving(false);
    await mutateWishlist();
  }

  async function updateStatus(item: WishlistItem, status: WishlistStatus) {
    // 乐观更新：立即更新展示状态
    await mutateWishlist(
      (prev) => prev
        ? { items: prev.items.map((i) => i.id === item.id ? { ...i, status } : i) }
        : prev,
      false
    );
    await fetch(`/api/wishlist/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        brandName: item.brand?.name ?? null,
        categoryId: item.categoryId ?? null,
        targetPriceCny:
          item.targetPriceCny != null && item.targetPriceCny !== "" ? Number(item.targetPriceCny) : null,
        currentSeenPriceCny:
          item.currentSeenPriceCny != null && item.currentSeenPriceCny !== ""
            ? Number(item.currentSeenPriceCny)
            : null,
        priority: item.priority,
        status,
        sourceUrl: item.sourceUrl ?? null,
        imageUrl: item.imageUrl ?? null,
        notes: item.notes ?? null
      })
    });
  }

  async function convertToPurchase(item: WishlistItem, priceStr: string) {
    const price = Number(priceStr);
    if (!priceStr || isNaN(price)) return;
    setConvertTarget(null);

    // 乐观更新：立即标记为已购买
    await mutateWishlist(
      (prev) =>
        prev
          ? { items: prev.items.map((i) => (i.id === item.id ? { ...i, status: "PURCHASED" as WishlistStatus } : i)) }
          : prev,
      false
    );

    await fetch(`/api/wishlist/${item.id}/convert-to-purchase`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaseDate: new Date().toISOString(),
        quantity: 1,
        unitPriceCny: price,
        totalPriceCny: null,
        channel: "wishlist-convert",
        isSecondHand: false,
        notes: `由心愿单转化: ${item.name}`
      })
    });

    await mutateWishlist();
  }

  return (
    <div className="space-y-6">
      <Card entryAnimation={false}>
        <h2 className="font-display text-xl text-neon">新增心愿单</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">装备名称</label>
            <Input
              value={form.name}
              onChange={(event) => setForm((s) => ({ ...s, name: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品牌</label>
            <Input
              value={form.brandName}
              onChange={(event) => setForm((s) => ({ ...s, brandName: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品类</label>
            <Select
              value={form.categoryId}
              onChange={(event) => setForm((s) => ({ ...s, categoryId: event.target.value }))}
            >
              <option value="">未分类</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">目标价 (CNY)</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.targetPriceCny}
              onChange={(event) => setForm((s) => ({ ...s, targetPriceCny: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">当前看到价格</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.currentSeenPriceCny}
              onChange={(event) => setForm((s) => ({ ...s, currentSeenPriceCny: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">优先级</label>
            <Select
              value={String(form.priority)}
              onChange={(event) => setForm((s) => ({ ...s, priority: Number(event.target.value) }))}
            >
              <option value="1">1 (最高)</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5 (最低)</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">状态</label>
            <Select
              value={form.status}
              onChange={(event) =>
                setForm((s) => ({ ...s, status: event.target.value as WishlistStatus }))
              }
            >
              <option value="WANT">想买</option>
              <option value="WATCHING">观望</option>
              <option value="PURCHASED">已买</option>
              <option value="DROPPED">放弃</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">来源链接</label>
            <Input
              value={form.sourceUrl}
              onChange={(event) => setForm((s) => ({ ...s, sourceUrl: event.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">图片链接</label>
            <Input
              value={form.imageUrl}
              onChange={(event) => setForm((s) => ({ ...s, imageUrl: event.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div className="xl:col-span-4">
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">备注</label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => setForm((s) => ({ ...s, notes: event.target.value }))}
            />
          </div>
        </div>

        <div className="mt-4">
          <Button type="button" onClick={submit} disabled={saving || !form.name}>
            {saving ? "保存中..." : "保存心愿"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => (
          <Card key={item.id} className="relative overflow-hidden" transition={{ delay: (index % 6) * 0.05 }}>
            <div className="absolute -right-7 -top-7 h-20 w-20 rounded-full bg-accent/15 blur-xl" />
            <div className="relative space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg text-text">{item.name}</h3>
                  <p className="text-sm text-mute">
                    {item.brand?.name ?? "未标记品牌"} · {item.category?.name ?? "未分类"}
                  </p>
                </div>
                <Badge variant={statusBadgeVariant[item.status]}>
                  {statusLabel[item.status]}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>目标价: {currency(item.targetPriceCny ? Number(item.targetPriceCny) : 0)}</p>
                <p>看到价: {currency(item.currentSeenPriceCny ? Number(item.currentSeenPriceCny) : 0)}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => void updateStatus(item, "WATCHING")}
                >
                  设为观望
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => void updateStatus(item, "DROPPED")}
                >
                  放弃
                </Button>
                {convertTarget?.item.id === item.id ? (
                  <div className="flex w-full items-center gap-2 pt-1">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="成交单价 (CNY)"
                      value={convertTarget.price}
                      onChange={(e) => setConvertTarget({ item, price: e.target.value })}
                      className="h-9 text-sm"
                    />
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => void convertToPurchase(item, convertTarget.price)}
                    >
                      确认
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => setConvertTarget(null)}
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setConvertTarget({ item, price: String(item.targetPriceCny ?? "") })}
                    disabled={item.status === "PURCHASED"}
                  >
                    转购买
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
