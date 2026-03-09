"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { currency, dateText } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
};

type PurchaseRow = {
  id: string;
  brandId?: string | null;
  categoryId?: string | null;
  itemNameSnapshot: string;
  gearItem?: { id: string; modelCode?: string | null } | null;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  unitPriceCny: number | string;
  quantity: number;
  totalPriceCny: number | string;
  itemStatus: "IN_USE" | "USED_UP" | "WORN_OUT" | "STORED";
  purchaseDate: string;
  channel?: string | null;
  notes?: string | null;
};

type PurchaseForm = {
  itemNameSnapshot: string;
  brandName: string;
  modelCode: string;
  categoryId: string;
  unitPriceCny: number;
  quantity: number;
  totalPriceCny: string;
  purchaseDate: string;
  channel: string;
  itemStatus: PurchaseRow["itemStatus"];
  notes: string;
};

type CatalogSuggestion = {
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

type PurchaseManagerMode = "entry" | "ledger" | "all";

const STATUS_LABELS: Record<PurchaseRow["itemStatus"], string> = {
  IN_USE: "在用",
  USED_UP: "用完",
  WORN_OUT: "穿坏/损坏",
  STORED: "闲置"
};

const initialForm: PurchaseForm = {
  itemNameSnapshot: "",
  brandName: "",
  modelCode: "",
  categoryId: "",
  unitPriceCny: 0,
  quantity: 1,
  totalPriceCny: "",
  purchaseDate: new Date().toISOString().slice(0, 16),
  channel: "",
  itemStatus: "IN_USE" as PurchaseRow["itemStatus"],
  notes: ""
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function toDatetimeLocalValue(value: string | Date) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function PurchaseManager({
  fallbackPurchases,
  fallbackCategories,
  mode = "all"
}: {
  fallbackPurchases?: PurchaseRow[];
  fallbackCategories?: Category[];
  mode?: PurchaseManagerMode;
} = {}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PurchaseForm>(initialForm);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryCategoryId, setLibraryCategoryId] = useState("");
  const [libraryView, setLibraryView] = useState<"list" | "card">("card");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PurchaseForm>(initialForm);
  const [editingSaving, setEditingSaving] = useState(false);

  const { data: purchaseData, isLoading: purchaseLoading, mutate: mutatePurchases } =
    useSWR<{ items: PurchaseRow[] }>("/api/purchases?pageSize=200", fetcher, {
      fallbackData: fallbackPurchases ? { items: fallbackPurchases } : undefined
    });
  const { data: categoryData } =
    useSWR<{ items: Category[] }>("/api/settings/categories", fetcher, {
      fallbackData: fallbackCategories ? { items: fallbackCategories } : undefined
    });
  const catalogUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("limit", "20");
    if (libraryCategoryId) params.set("categoryId", libraryCategoryId);
    if (catalogQuery.trim()) params.set("q", catalogQuery.trim());
    return `/api/catalog?${params.toString()}`;
  }, [catalogQuery, libraryCategoryId]);
  const { data: catalogData, isLoading: catalogLoading } =
    useSWR<{ items: CatalogSuggestion[] }>(catalogUrl, fetcher);
  const libraryUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("scope", "project");
    params.set("limit", "2000");
    if (libraryCategoryId) params.set("categoryId", libraryCategoryId);
    if (libraryQuery.trim()) params.set("q", libraryQuery.trim());
    return `/api/catalog?${params.toString()}`;
  }, [libraryCategoryId, libraryQuery]);
  const { data: libraryData, isLoading: libraryLoading } =
    useSWR<{ items: CatalogSuggestion[] }>(libraryUrl, fetcher);

  const items = purchaseData?.items ?? [];
  const categories = categoryData?.items ?? [];
  const loading = purchaseLoading;
  const catalogItems = catalogData?.items ?? [];
  const libraryItems = libraryData?.items ?? [];
  const isEntryVisible = mode === "entry" || mode === "all";
  const isLedgerVisible = mode === "ledger" || mode === "all";
  const categoryFilterItems = useMemo(
    () => [{ id: "", name: "全部" }, ...categories],
    [categories]
  );

  const totalPreview = useMemo(() => {
    if (form.totalPriceCny !== "") return Number(form.totalPriceCny || 0);
    return Number(form.unitPriceCny) * Number(form.quantity || 1);
  }, [form.quantity, form.totalPriceCny, form.unitPriceCny]);

  const editTotalPreview = useMemo(() => {
    if (editForm.totalPriceCny !== "") return Number(editForm.totalPriceCny || 0);
    return Number(editForm.unitPriceCny) * Number(editForm.quantity || 1);
  }, [editForm.quantity, editForm.totalPriceCny, editForm.unitPriceCny]);

  const shuttleGroups = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; totalQty: number; usedUpQty: number; activeQty: number; latestDate: string }
    >();

    for (const item of items) {
      const categoryName = item.category?.name ?? "";
      const isShuttle =
        categoryName.includes("羽毛球") ||
        item.itemNameSnapshot.includes("羽毛球") ||
        item.itemNameSnapshot.includes("亚狮龙") ||
        item.itemNameSnapshot.includes("黄超");

      if (!isShuttle) continue;

      const key = item.itemNameSnapshot.trim().replace(/\s+/g, " ").toUpperCase();
      const current = groups.get(key) ?? {
        name: item.itemNameSnapshot.trim(),
        totalQty: 0,
        usedUpQty: 0,
        activeQty: 0,
        latestDate: item.purchaseDate
      };

      current.totalQty += item.quantity;
      if (item.itemStatus === "USED_UP") {
        current.usedUpQty += item.quantity;
      } else {
        current.activeQty += item.quantity;
      }
      if (new Date(item.purchaseDate).getTime() > new Date(current.latestDate).getTime()) {
        current.latestDate = item.purchaseDate;
      }

      groups.set(key, current);
    }

    return [...groups.values()].sort(
      (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );
  }, [items]);

  async function submit() {
    if (!form.itemNameSnapshot) return;
    setSaving(true);

    const payload = {
      ...form,
      categoryId: form.categoryId || null,
      brandName: form.brandName || null,
      modelCode: form.modelCode || null,
      channel: form.channel || null,
      notes: form.notes || null,
      totalPriceCny: form.totalPriceCny === "" ? null : Number(form.totalPriceCny),
      purchaseDate: new Date(form.purchaseDate).toISOString(),
      unitPriceCny: Number(form.unitPriceCny),
      quantity: Number(form.quantity),
      itemStatus: form.itemStatus
    };

    await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setForm((prev) => ({
      ...initialForm,
      categoryId: prev.categoryId || libraryCategoryId
    }));
    setCreateOpen(false);
    setSaving(false);
    await mutatePurchases();
  }

  async function remove(id: string) {
    // 乐观更新：立即从列表移除，后台执行删除
    await mutatePurchases(
      (prev) => prev ? { items: prev.items.filter((item) => item.id !== id) } : prev,
      false
    );
    await fetch(`/api/purchases/${id}`, { method: "DELETE" });
    await mutatePurchases();
  }

  async function updateStatus(id: string, itemStatus: PurchaseRow["itemStatus"]) {
    // 乐观更新：立即更新状态，后台同步
    await mutatePurchases(
      (prev) => prev
        ? { items: prev.items.map((item) => item.id === id ? { ...item, itemStatus } : item) }
        : prev,
      false
    );
    await fetch(`/api/purchases/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemStatus })
    });
  }

  function openEdit(item: PurchaseRow) {
    setEditingId(item.id);
    setEditForm({
      itemNameSnapshot: item.itemNameSnapshot,
      brandName: item.brand?.name ?? "",
      modelCode: item.gearItem?.modelCode ?? "",
      categoryId: item.categoryId ?? "",
      unitPriceCny: Number(item.unitPriceCny),
      quantity: item.quantity,
      totalPriceCny: Number(item.totalPriceCny).toString(),
      purchaseDate: toDatetimeLocalValue(item.purchaseDate),
      channel: item.channel ?? "",
      itemStatus: item.itemStatus,
      notes: item.notes ?? ""
    });
  }

  function closeEdit() {
    setEditingId(null);
    setEditForm(initialForm);
  }

  async function saveEdit() {
    if (!editingId || !editForm.itemNameSnapshot) return;

    setEditingSaving(true);
    const payload = {
      ...editForm,
      categoryId: editForm.categoryId || null,
      brandName: editForm.brandName || null,
      modelCode: editForm.modelCode || null,
      channel: editForm.channel || null,
      notes: editForm.notes || null,
      totalPriceCny: editForm.totalPriceCny === "" ? null : Number(editForm.totalPriceCny),
      purchaseDate: new Date(editForm.purchaseDate).toISOString(),
      unitPriceCny: Number(editForm.unitPriceCny),
      quantity: Number(editForm.quantity),
      itemStatus: editForm.itemStatus
    };

    await fetch(`/api/purchases/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    setEditingSaving(false);
    closeEdit();
    await mutatePurchases();
  }

  async function importCSV(file: File) {
    const csv = await file.text();
    await fetch("/api/purchases/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv })
    });
    await mutatePurchases();
  }

  function applySuggestion(item: CatalogSuggestion) {
    setForm((state) => ({
      ...state,
      itemNameSnapshot: item.name || state.itemNameSnapshot,
      brandName: item.brandName || state.brandName,
      modelCode: item.modelCode || state.modelCode,
      categoryId: item.categoryId || state.categoryId,
      unitPriceCny:
        typeof item.suggestedUnitPriceCny === "number" && Number.isFinite(item.suggestedUnitPriceCny)
          ? item.suggestedUnitPriceCny
          : state.unitPriceCny,
      totalPriceCny: ""
    }));
    setCreateOpen(true);
  }

  function applyLibraryItem(item: CatalogSuggestion) {
    const parsedPrice = Number(item.suggestedUnitPriceCny ?? Number.NaN);
    setForm((state) => ({
      ...state,
      itemNameSnapshot: item.name || state.itemNameSnapshot,
      brandName: item.brandName ?? state.brandName,
      modelCode: item.modelCode ?? state.modelCode,
      categoryId: item.categoryId ?? state.categoryId,
      unitPriceCny: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : state.unitPriceCny,
      totalPriceCny: ""
    }));
    setCreateOpen(true);
  }

  function openCreateModal() {
    setForm((state) => ({
      ...state,
      categoryId: state.categoryId || libraryCategoryId || "",
      purchaseDate: new Date().toISOString().slice(0, 16)
    }));
    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateOpen(false);
  }

  return (
    <div className="space-y-6">
      {isEntryVisible ? (
        <Card animate={false} className="min-h-[78vh]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-neon">项目装备库</h2>
              <p className="mt-1 text-sm text-mute">先按品类筛选装备库，点击装备后弹窗录入购买信息。</p>
            </div>
            <Button type="button" onClick={openCreateModal}>
              手动新增
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {categoryFilterItems.map((item) => (
              <button
                key={item.id || "all"}
                type="button"
                className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                  libraryCategoryId === item.id
                    ? "border-accent/55 bg-accent/15 text-accent"
                    : "border-border bg-panel text-mute hover:bg-panel-2 hover:text-text"
                }`}
                onClick={() => setLibraryCategoryId(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
            <Input
              value={libraryQuery}
              onChange={(event) => {
                setLibraryQuery(event.target.value);
                setCatalogQuery(event.target.value);
              }}
              placeholder="搜索项目装备库：名称 / 型号 / 品牌"
            />
            <div className="flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs transition ${libraryView === "card" ? "bg-accent/15 text-accent" : "text-mute hover:bg-panel"}`}
                onClick={() => setLibraryView("card")}
              >
                卡片
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs transition ${libraryView === "list" ? "bg-accent/15 text-accent" : "text-mute hover:bg-panel"}`}
                onClick={() => setLibraryView("list")}
              >
                列表
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {catalogItems.slice(0, 8).map((item) => (
              <button
                key={item.id}
                type="button"
                className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs text-mute transition hover:border-accent/55 hover:text-text"
                onClick={() => applySuggestion(item)}
              >
                {item.name}
              </button>
            ))}
            {!catalogLoading && !catalogItems.length ? (
              <span className="text-xs text-mute">暂无快捷推荐</span>
            ) : null}
          </div>

          <div className="mt-4 h-[66vh] overflow-y-auto rounded-xl border border-border bg-panel-2">
            {libraryItems.length ? (
              libraryView === "list" ? (
                <div className="divide-y divide-border">
                  {libraryItems.map((item) => {
                    const latestPrice = Number(item.suggestedUnitPriceCny ?? Number.NaN);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-panel"
                        onClick={() => applyLibraryItem(item)}
                      >
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-14 w-14 rounded-md border border-border object-contain bg-white"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-md border border-dashed border-border" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-text">{item.name}</div>
                          <div className="truncate text-xs text-mute">
                            {(item.brandName || "未知品牌") + " · " + (item.modelCode || "无型号") + " · " + (item.categoryName || "未分类")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-mute">参考价</div>
                          <div className="text-sm text-text">{Number.isFinite(latestPrice) && latestPrice > 0 ? currency(latestPrice) : "-"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {libraryItems.map((item) => {
                    const latestPrice = Number(item.suggestedUnitPriceCny ?? Number.NaN);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="group h-full rounded-2xl border border-border bg-panel p-4 text-left transition-all duration-300 hover:border-accent/35"
                        onClick={() => applyLibraryItem(item)}
                      >
                        <div className="space-y-3">
                          <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-panel-2 shadow-inner">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs font-medium uppercase tracking-widest text-text-mute">
                                No Image
                              </div>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            <div className="line-clamp-2 text-sm font-semibold leading-tight text-text transition-colors group-hover:text-accent">
                              {item.name}
                            </div>
                            <div className="line-clamp-1 text-xs text-text-mute">
                              {item.brandName || "未知品牌"} · {item.modelCode || "无型号"}
                            </div>
                            <div className="line-clamp-1 text-xs text-text-mute">
                              {item.categoryName || "未分类"}
                            </div>
                            <div className="text-sm font-semibold text-text">
                              {Number.isFinite(latestPrice) && latestPrice > 0 ? currency(latestPrice) : "-"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="flex h-full items-center justify-center px-3 text-sm text-mute">
                {libraryLoading ? "加载装备库中..." : "暂无匹配装备"}
              </div>
            )}
          </div>
        </Card>
      ) : null}

      {isEntryVisible && createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl text-neon">新增购买记录</h2>
              <Button type="button" variant="ghost" onClick={closeCreateModal}>
                关闭
              </Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">装备名称</label>
                <Input
                  value={form.itemNameSnapshot}
                  onChange={(event) => setForm((s) => ({ ...s, itemNameSnapshot: event.target.value }))}
                  placeholder="YONEX ASTROX 100ZZ"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品牌</label>
                <Input
                  value={form.brandName}
                  onChange={(event) => setForm((s) => ({ ...s, brandName: event.target.value }))}
                  placeholder="YONEX"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">型号</label>
                <Input
                  value={form.modelCode}
                  onChange={(event) => setForm((s) => ({ ...s, modelCode: event.target.value }))}
                  placeholder="AS-50 / P9200TTY / TK-HMR"
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
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">单价 (CNY)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unitPriceCny}
                  onChange={(event) =>
                    setForm((s) => ({
                      ...s,
                      unitPriceCny: Number(event.target.value),
                      totalPriceCny: ""
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">数量</label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((s) => ({
                      ...s,
                      quantity: Number(event.target.value),
                      totalPriceCny: ""
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">总价覆盖 (可选)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.totalPriceCny}
                  onChange={(event) => setForm((s) => ({ ...s, totalPriceCny: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">购买时间</label>
                <Input
                  type="datetime-local"
                  value={form.purchaseDate}
                  onChange={(event) => setForm((s) => ({ ...s, purchaseDate: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">渠道</label>
                <Input
                  value={form.channel}
                  onChange={(event) => setForm((s) => ({ ...s, channel: event.target.value }))}
                  placeholder="京东 / 闲鱼 / 线下店"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">状态</label>
                <Select
                  value={form.itemStatus}
                  onChange={(event) =>
                    setForm((s) => ({
                      ...s,
                      itemStatus: event.target.value as PurchaseRow["itemStatus"]
                    }))
                  }
                >
                  <option value="IN_USE">在用</option>
                  <option value="USED_UP">用完</option>
                  <option value="WORN_OUT">穿坏/损坏</option>
                  <option value="STORED">闲置</option>
                </Select>
              </div>
              <div className="xl:col-span-3">
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">备注</label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(event) => setForm((s) => ({ ...s, notes: event.target.value }))}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={submit} disabled={saving}>
                {saving ? "保存中..." : "保存记录"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeCreateModal}>
                取消
              </Button>
              <span className="text-sm text-mute">预估总价: {currency(totalPreview)}</span>
            </div>
          </Card>
        </div>
      ) : null}

      {isLedgerVisible ? (
      <Card animate={false}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl text-neon">购买记录</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-mute">{items.length} 条</span>
            <a
              className="rounded-lg border border-border px-3 py-2 text-xs text-text transition hover:bg-border/40"
              href="/api/purchases/export"
            >
              导出 CSV
            </a>
            <label className="cursor-pointer rounded-lg border border-border px-3 py-2 text-xs text-text transition hover:bg-border/40">
              导入 CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    void importCSV(file);
                  }
                  event.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {loading ? <p className="text-sm text-mute">加载中...</p> : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="pb-2">日期</th>
                <th className="pb-2">名称</th>
                <th className="pb-2">型号</th>
                <th className="pb-2">品牌</th>
                <th className="pb-2">品类</th>
                <th className="pb-2">状态</th>
                <th className="pb-2 text-right">单价</th>
                <th className="pb-2 text-right">数量</th>
                <th className="pb-2 text-right">总价</th>
                <th className="pb-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-2 text-mute">{dateText(item.purchaseDate)}</td>
                  <td className="py-2">{item.itemNameSnapshot}</td>
                  <td className="py-2">{item.gearItem?.modelCode ?? "-"}</td>
                  <td className="py-2">{item.brand?.name ?? "-"}</td>
                  <td className="py-2">{item.category?.name ?? "-"}</td>
                  <td className="py-2">
                    <Select
                      value={item.itemStatus}
                      onChange={(event) =>
                        void updateStatus(
                          item.id,
                          event.target.value as PurchaseRow["itemStatus"]
                        )
                      }
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="py-2 text-right">{currency(Number(item.unitPriceCny))}</td>
                  <td className="py-2 text-right">{item.quantity}</td>
                  <td className="py-2 text-right text-neon">{currency(Number(item.totalPriceCny))}</td>
                  <td className="py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" type="button" onClick={() => openEdit(item)}>
                        编辑
                      </Button>
                      <Button variant="danger" type="button" onClick={() => void remove(item.id)}>
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !items.length ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-mute">
                    暂无数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
      ) : null}

      {isLedgerVisible && editingId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="max-h-[92vh] w-full max-w-4xl overflow-y-auto">
            <h2 className="font-display text-xl text-neon">编辑购买记录</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">装备名称</label>
                <Input
                  value={editForm.itemNameSnapshot}
                  onChange={(event) => setEditForm((s) => ({ ...s, itemNameSnapshot: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品牌</label>
                <Input
                  value={editForm.brandName}
                  onChange={(event) => setEditForm((s) => ({ ...s, brandName: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">型号</label>
                <Input
                  value={editForm.modelCode}
                  onChange={(event) => setEditForm((s) => ({ ...s, modelCode: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品类</label>
                <Select
                  value={editForm.categoryId}
                  onChange={(event) => setEditForm((s) => ({ ...s, categoryId: event.target.value }))}
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
                  step="0.01"
                  value={editForm.unitPriceCny}
                  onChange={(event) =>
                    setEditForm((s) => ({
                      ...s,
                      unitPriceCny: Number(event.target.value),
                      totalPriceCny: ""
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">数量</label>
                <Input
                  type="number"
                  min={1}
                  value={editForm.quantity}
                  onChange={(event) =>
                    setEditForm((s) => ({
                      ...s,
                      quantity: Number(event.target.value),
                      totalPriceCny: ""
                    }))
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">总价覆盖 (可选)</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.totalPriceCny}
                  onChange={(event) => setEditForm((s) => ({ ...s, totalPriceCny: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">购买时间</label>
                <Input
                  type="datetime-local"
                  value={editForm.purchaseDate}
                  onChange={(event) => setEditForm((s) => ({ ...s, purchaseDate: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">渠道</label>
                <Input
                  value={editForm.channel}
                  onChange={(event) => setEditForm((s) => ({ ...s, channel: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">状态</label>
                <Select
                  value={editForm.itemStatus}
                  onChange={(event) =>
                    setEditForm((s) => ({
                      ...s,
                      itemStatus: event.target.value as PurchaseRow["itemStatus"]
                    }))
                  }
                >
                  <option value="IN_USE">在用</option>
                  <option value="USED_UP">用完</option>
                  <option value="WORN_OUT">穿坏/损坏</option>
                  <option value="STORED">闲置</option>
                </Select>
              </div>
              <div className="xl:col-span-3">
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">备注</label>
                <Textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(event) => setEditForm((s) => ({ ...s, notes: event.target.value }))}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="button" onClick={() => void saveEdit()} disabled={editingSaving}>
                {editingSaving ? "保存中..." : "保存修改"}
              </Button>
              <Button type="button" variant="ghost" onClick={closeEdit}>
                取消
              </Button>
              <span className="text-sm text-mute">预估总价: {currency(editTotalPreview)}</span>
            </div>
          </Card>
        </div>
      ) : null}

      {isLedgerVisible && shuttleGroups.length ? (
        <Card animate={false}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-neon">羽毛球同类汇总</h2>
            <span className="text-xs text-mute">按球型号聚合新购与用完记录</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-mute">
                <tr>
                  <th className="pb-2">球型号</th>
                  <th className="pb-2 text-right">累计购入</th>
                  <th className="pb-2 text-right">未用完</th>
                  <th className="pb-2 text-right">已用完</th>
                  <th className="pb-2 text-right">最近购入</th>
                </tr>
              </thead>
              <tbody>
                {shuttleGroups.map((group) => (
                  <tr key={group.name} className="border-t border-border">
                    <td className="py-2">{group.name}</td>
                    <td className="py-2 text-right">{group.totalQty}</td>
                    <td className="py-2 text-right text-accent">{group.activeQty}</td>
                    <td className="py-2 text-right">{group.usedUpQty}</td>
                    <td className="py-2 text-right text-mute">{dateText(group.latestDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
