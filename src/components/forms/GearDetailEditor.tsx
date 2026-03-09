"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { currency, dateText } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
};

type ExternalReviewInput = {
  sourceName: string;
  sourceUrl: string;
  scoreText: string;
  summaryText: string;
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
  rating: {
    power: number;
    control: number;
    durability: number;
    comfort: number;
    value: number;
    overall: number;
    reviewText: string;
  };
  externalReviews: ExternalReviewInput[];
  purchases: PurchaseView[];
};

const STATUS_LABELS: Record<PurchaseView["itemStatus"], string> = {
  IN_USE: "在用",
  USED_UP: "用完",
  WORN_OUT: "损坏",
  STORED: "闲置"
};

type PurchaseEditForm = {
  itemNameSnapshot: string;
  brandName: string;
  modelCode: string;
  categoryId: string;
  unitPriceCny: number;
  quantity: number;
  totalPriceCny: string;
  purchaseDate: string;
  channel: string;
  itemStatus: PurchaseView["itemStatus"];
  notes: string;
  isSecondHand: boolean;
};

function toDatetimeLocalValue(value: string | Date) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function fromApiPurchase(item: {
  id: string;
  categoryId?: string | null;
  purchaseDate: string;
  itemNameSnapshot: string;
  itemStatus: "IN_USE" | "USED_UP" | "WORN_OUT" | "STORED";
  unitPriceCny?: string | number;
  quantity?: number;
  totalPriceCny: string | number;
  channel?: string | null;
  notes?: string | null;
  isSecondHand?: boolean;
  brand?: { name: string } | null;
  gearItem?: { modelCode?: string | null } | null;
  category?: { name: string } | null;
}): PurchaseView {
  return {
    id: item.id,
    categoryId: item.categoryId ?? "",
    purchaseDate: item.purchaseDate,
    itemNameSnapshot: item.itemNameSnapshot,
    itemStatus: item.itemStatus,
    unitPriceCny: Number(item.unitPriceCny ?? 0),
    quantity: Number(item.quantity ?? 1),
    totalPriceCny: Number(item.totalPriceCny),
    channel: item.channel ?? "",
    notes: item.notes ?? "",
    isSecondHand: Boolean(item.isSecondHand),
    brand: item.brand ?? null,
    gearItem: item.gearItem ?? null,
    category: item.category ?? null
  };
}

export function GearDetailEditor({
  initialData,
  categories
}: {
  initialData: GearDetailData;
  categories: Category[];
}) {
  const [form, setForm] = useState<GearDetailData>(initialData);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseEditForm | null>(null);
  const [savingPurchase, setSavingPurchase] = useState(false);

  const hasExternalReviews = useMemo(
    () => form.externalReviews.some((item) => item.sourceName || item.sourceUrl || item.summaryText),
    [form.externalReviews]
  );

  async function uploadCover(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.url) {
      setForm((state) => ({ ...state, coverImageUrl: data.url }));
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    const payload = {
      name: form.name,
      brandName: form.brandName || null,
      categoryId: form.categoryId || null,
      modelCode: form.modelCode || null,
      coverImageUrl: form.coverImageUrl || null,
      notes: form.notes || null,
      rating: {
        power: Number(form.rating.power),
        control: Number(form.rating.control),
        durability: Number(form.rating.durability),
        comfort: Number(form.rating.comfort),
        value: Number(form.rating.value),
        overall: Number(form.rating.overall),
        reviewText: form.rating.reviewText || null
      },
      externalReviews: form.externalReviews
        .filter((item) => item.sourceName && item.sourceUrl)
        .map((item) => ({
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
          scoreText: item.scoreText || null,
          summaryText: item.summaryText || null
        }))
    };

    const res = await fetch(`/api/gear/${form.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      setSaving(false);
      setMessage("保存失败，请检查输入内容");
      return;
    }

    const data = await res.json();
    const latestRating = data.ratings?.[0];

    setForm((state) => ({
      ...state,
      name: data.name ?? state.name,
      brandName: data.brand?.name ?? "",
      categoryId: data.categoryId ?? "",
      modelCode: data.modelCode ?? "",
      coverImageUrl: data.coverImageUrl ?? "",
      notes: data.notes ?? "",
      rating: {
        power: latestRating ? Number(latestRating.power) : state.rating.power,
        control: latestRating ? Number(latestRating.control) : state.rating.control,
        durability: latestRating ? Number(latestRating.durability) : state.rating.durability,
        comfort: latestRating ? Number(latestRating.comfort) : state.rating.comfort,
        value: latestRating ? Number(latestRating.value) : state.rating.value,
        overall: latestRating ? Number(latestRating.overall) : state.rating.overall,
        reviewText: latestRating?.reviewText ?? ""
      },
      externalReviews:
        (data.externalViews ?? []).map((item: {
          sourceName: string;
          sourceUrl: string;
          scoreText?: string | null;
          summaryText?: string | null;
        }) => ({
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
          scoreText: item.scoreText ?? "",
          summaryText: item.summaryText ?? ""
        })) || [],
      purchases: (data.purchases ?? []).map(fromApiPurchase) ?? state.purchases
    }));

    setSaving(false);
    setMessage("保存成功");
  }

  function openPurchaseEdit(purchase: PurchaseView) {
    setEditingPurchaseId(purchase.id);
    setPurchaseForm({
      itemNameSnapshot: purchase.itemNameSnapshot,
      brandName: purchase.brand?.name ?? "",
      modelCode: purchase.gearItem?.modelCode ?? "",
      categoryId: purchase.categoryId ?? "",
      unitPriceCny: purchase.unitPriceCny,
      quantity: purchase.quantity,
      totalPriceCny: purchase.totalPriceCny.toString(),
      purchaseDate: toDatetimeLocalValue(purchase.purchaseDate),
      channel: purchase.channel ?? "",
      itemStatus: purchase.itemStatus,
      notes: purchase.notes ?? "",
      isSecondHand: purchase.isSecondHand
    });
  }

  function closePurchaseEdit() {
    setEditingPurchaseId(null);
    setPurchaseForm(null);
  }

  async function savePurchaseEdit() {
    if (!editingPurchaseId || !purchaseForm) return;
    setSavingPurchase(true);

    const payload = {
      itemNameSnapshot: purchaseForm.itemNameSnapshot,
      brandName: purchaseForm.brandName || null,
      modelCode: purchaseForm.modelCode || null,
      categoryId: purchaseForm.categoryId || null,
      unitPriceCny: Number(purchaseForm.unitPriceCny),
      quantity: Number(purchaseForm.quantity),
      totalPriceCny: purchaseForm.totalPriceCny === "" ? null : Number(purchaseForm.totalPriceCny),
      purchaseDate: new Date(purchaseForm.purchaseDate).toISOString(),
      channel: purchaseForm.channel || null,
      itemStatus: purchaseForm.itemStatus,
      notes: purchaseForm.notes || null,
      isSecondHand: purchaseForm.isSecondHand
    };

    const res = await fetch(`/api/purchases/${editingPurchaseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      setSavingPurchase(false);
      setMessage("购买记录更新失败");
      return;
    }

    const updated = await res.json();
    setForm((state) => ({
      ...state,
      purchases: state.purchases.map((item) => (item.id === editingPurchaseId ? fromApiPurchase(updated) : item))
    }));
    setSavingPurchase(false);
    closePurchaseEdit();
    setMessage("购买记录已同步更新");
  }

  const purchaseTotalPreview = useMemo(() => {
    if (!purchaseForm) return 0;
    if (purchaseForm.totalPriceCny !== "") return Number(purchaseForm.totalPriceCny || 0);
    return Number(purchaseForm.unitPriceCny || 0) * Number(purchaseForm.quantity || 1);
  }, [purchaseForm]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title={form.name}
        subtitle={`${form.brandName || "未知品牌"} · ${categories.find((item) => item.id === form.categoryId)?.name ?? "未分类"}`}
      />

      <Card>
        <h2 className="font-display text-lg text-neon">编辑装备信息</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">装备名称</label>
            <Input
              value={form.name}
              onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品牌</label>
            <Input
              value={form.brandName}
              onChange={(event) => setForm((state) => ({ ...state, brandName: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">型号</label>
            <Input
              value={form.modelCode}
              onChange={(event) => setForm((state) => ({ ...state, modelCode: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品类</label>
            <Select
              value={form.categoryId}
              onChange={(event) => setForm((state) => ({ ...state, categoryId: event.target.value }))}
            >
              <option value="">未分类</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="xl:col-span-2">
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">封面图 URL</label>
            <Input
              value={form.coverImageUrl}
              onChange={(event) =>
                setForm((state) => ({ ...state, coverImageUrl: event.target.value }))
              }
              placeholder="https://... 或 /gear-images/..."
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">上传封面</label>
            <Input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void uploadCover(file);
                }
              }}
            />
          </div>
          <div className="xl:col-span-4">
            <label className="mb-1 block text-xs uppercase tracking-widest text-mute">备注</label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(event) => setForm((state) => ({ ...state, notes: event.target.value }))}
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-mute">创建时间：{dateText(form.createdAt)}</p>
      </Card>

      <Card>
        <h2 className="font-display text-lg text-neon">评分信息</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[
            { key: "power", label: "进攻" },
            { key: "control", label: "控制" },
            { key: "durability", label: "耐用" },
            { key: "comfort", label: "舒适" },
            { key: "value", label: "性价比" },
            { key: "overall", label: "总评" }
          ].map((metric) => (
            <div key={metric.key}>
              <label className="mb-1 block text-xs uppercase tracking-widest text-mute">{metric.label}</label>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={String(form.rating[metric.key as keyof typeof form.rating])}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    rating: {
                      ...state.rating,
                      [metric.key]: Number(event.target.value)
                    }
                  }))
                }
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-xs uppercase tracking-widest text-mute">评语</label>
          <Textarea
            rows={2}
            value={form.rating.reviewText}
            onChange={(event) =>
              setForm((state) => ({
                ...state,
                rating: {
                  ...state.rating,
                  reviewText: event.target.value
                }
              }))
            }
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg text-neon">外网评价引用</h2>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              setForm((state) => ({
                ...state,
                externalReviews: [
                  ...state.externalReviews,
                  { sourceName: "", sourceUrl: "", scoreText: "", summaryText: "" }
                ]
              }))
            }
          >
            <Plus size={16} className="mr-1" />
            新增来源
          </Button>
        </div>

        {!hasExternalReviews ? <p className="mt-3 text-sm text-mute">暂无来源，点击“新增来源”添加。</p> : null}

        <div className="mt-4 space-y-3">
          {form.externalReviews.map((review, index) => (
            <div key={`${review.sourceName}-${index}`} className="rounded-lg border border-[color:var(--glass-border)] bg-panel-2 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-mute">来源 #{index + 1}</span>
                <button
                  type="button"
                  className="rounded p-1 text-mute transition hover:text-danger"
                  onClick={() =>
                    setForm((state) => ({
                      ...state,
                      externalReviews: state.externalReviews.filter((_, itemIndex) => itemIndex !== index)
                    }))
                  }
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Input
                  value={review.sourceName}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      externalReviews: state.externalReviews.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, sourceName: event.target.value } : item
                      )
                    }))
                  }
                  placeholder="中羽 / B站 / 论坛"
                />
                <Input
                  value={review.sourceUrl}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      externalReviews: state.externalReviews.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, sourceUrl: event.target.value } : item
                      )
                    }))
                  }
                  placeholder="https://..."
                />
                <Input
                  value={review.scoreText}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      externalReviews: state.externalReviews.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, scoreText: event.target.value } : item
                      )
                    }))
                  }
                  placeholder="4.8 / 5"
                />
              </div>
              <div className="mt-3">
                <Textarea
                  rows={2}
                  value={review.summaryText}
                  onChange={(event) =>
                    setForm((state) => ({
                      ...state,
                      externalReviews: state.externalReviews.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, summaryText: event.target.value } : item
                      )
                    }))
                  }
                  placeholder="摘要"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? "保存中..." : "保存全部信息"}
        </Button>
        {message ? <span className="text-sm text-mute">{message}</span> : null}
        <Link href="/gear-wall" className="text-sm text-accent underline-offset-2 hover:underline">
          返回装备墙
        </Link>
      </div>

      <Card>
        <h2 className="font-display text-lg text-neon">关联购买记录</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="pb-2">日期</th>
                <th className="pb-2">名称</th>
                <th className="pb-2">型号</th>
                <th className="pb-2">品牌</th>
                <th className="pb-2">品类</th>
                <th className="pb-2">状态</th>
                <th className="pb-2 text-right">数量</th>
                <th className="pb-2 text-right">单价</th>
                <th className="pb-2 text-right">金额</th>
                <th className="pb-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {form.purchases.map((purchase) => (
                <tr key={purchase.id} className="border-t border-[color:var(--glass-border)]">
                  <td className="py-2 text-mute">{dateText(purchase.purchaseDate)}</td>
                  <td className="py-2">{purchase.itemNameSnapshot}</td>
                  <td className="py-2">{purchase.gearItem?.modelCode ?? "-"}</td>
                  <td className="py-2">{purchase.brand?.name ?? "-"}</td>
                  <td className="py-2">{purchase.category?.name ?? "-"}</td>
                  <td className="py-2">{STATUS_LABELS[purchase.itemStatus]}</td>
                  <td className="py-2 text-right">{purchase.quantity}</td>
                  <td className="py-2 text-right">{currency(purchase.unitPriceCny)}</td>
                  <td className="py-2 text-right text-neon">{currency(purchase.totalPriceCny)}</td>
                  <td className="py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openPurchaseEdit(purchase)}
                    >
                      编辑
                    </Button>
                  </td>
                </tr>
              ))}
              {!form.purchases.length ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-mute">
                    暂无关联购买
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {editingPurchaseId && purchaseForm ? (
          <div className="mt-4 rounded-lg border border-[color:var(--glass-border)] bg-panel p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-display text-base">编辑购买记录</h3>
              <span className="text-xs text-mute">ID: {editingPurchaseId}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="xl:col-span-2">
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">名称</label>
                <Input
                  value={purchaseForm.itemNameSnapshot}
                  onChange={(event) =>
                    setPurchaseForm((state) => (state ? { ...state, itemNameSnapshot: event.target.value } : state))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品牌</label>
                <Input
                  value={purchaseForm.brandName}
                  onChange={(event) =>
                    setPurchaseForm((state) => (state ? { ...state, brandName: event.target.value } : state))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">型号</label>
                <Input
                  value={purchaseForm.modelCode}
                  onChange={(event) =>
                    setPurchaseForm((state) => (state ? { ...state, modelCode: event.target.value } : state))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品类</label>
                <Select
                  value={purchaseForm.categoryId}
                  onChange={(event) =>
                    setPurchaseForm((state) => (state ? { ...state, categoryId: event.target.value } : state))
                  }
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
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">单价 (CNY)</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={purchaseForm.unitPriceCny}
                  onChange={(event) =>
                    setPurchaseForm((state) =>
                      state ? { ...state, unitPriceCny: Number(event.target.value || 0) } : state
                    )
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">数量</label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={purchaseForm.quantity}
                  onChange={(event) =>
                    setPurchaseForm((state) =>
                      state ? { ...state, quantity: Number(event.target.value || 1) } : state
                    )
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">总价 (可留空自动算)</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={purchaseForm.totalPriceCny}
                  onChange={(event) =>
                    setPurchaseForm((state) => (state ? { ...state, totalPriceCny: event.target.value } : state))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">购买日期</label>
                <Input
                  type="datetime-local"
                  value={purchaseForm.purchaseDate}
                  onChange={(event) =>
                    setPurchaseForm((state) => (state ? { ...state, purchaseDate: event.target.value } : state))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">状态</label>
                <Select
                  value={purchaseForm.itemStatus}
                  onChange={(event) =>
                    setPurchaseForm((state) =>
                      state
                        ? { ...state, itemStatus: event.target.value as PurchaseView["itemStatus"] }
                        : state
                    )
                  }
                >
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">渠道</label>
                <Input
                  value={purchaseForm.channel}
                  onChange={(event) =>
                    setPurchaseForm((state) => (state ? { ...state, channel: event.target.value } : state))
                  }
                  placeholder="京东 / 拼多多 / 线下"
                />
              </div>
              <div className="xl:col-span-4">
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">备注</label>
                <Textarea
                  rows={2}
                  value={purchaseForm.notes}
                  onChange={(event) =>
                    setPurchaseForm((state) => (state ? { ...state, notes: event.target.value } : state))
                  }
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-mute">实时总价预览：{currency(purchaseTotalPreview)}</p>
            <div className="mt-3 flex gap-2">
              <Button type="button" onClick={savePurchaseEdit} disabled={savingPurchase}>
                {savingPurchase ? "保存中..." : "保存购买记录"}
              </Button>
              <Button type="button" variant="secondary" onClick={closePurchaseEdit} disabled={savingPurchase}>
                取消
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
