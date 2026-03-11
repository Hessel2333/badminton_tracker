"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ControlPanel } from "@/components/ui/ControlPanel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import {
  canonicalOptionalBrandDisplayName,
  canonicalProductKey,
  canonicalProductName
} from "@/lib/business-rules";
import { getPurchaseChannelOptions } from "@/lib/purchase-options";
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
  gearCoverImageUrl: string;
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

const PROJECT_LIBRARY_FAVORITES_KEY = "project-library-favorites-v1";

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
  gearCoverImageUrl: "",
  unitPriceCny: 0,
  quantity: 1,
  totalPriceCny: "",
  purchaseDate: currentDateInputValue(),
  channel: "",
  itemStatus: "IN_USE" as PurchaseRow["itemStatus"],
  notes: ""
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function currentDateInputValue() {
  return toDateInputValue(new Date());
}

function toDateInputValue(value: string | Date | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  try {
    return date.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function toPurchaseIsoDate(value: string) {
  if (!value) return new Date().toISOString();
  // 移除空格，确保符合 ISO 8601 标准 (YYYY-MM-DDTHH:mm:ss+HH:mm)
  const dateSeed = `${value}T00:00:00+08:00`;
  const date = new Date(dateSeed);
  if (isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function isShuttleLikeRow(item: Pick<PurchaseRow, "itemNameSnapshot" | "category" | "gearItem" | "brand">) {
  const seed = [
    item.category?.name ?? "",
    item.itemNameSnapshot,
    item.gearItem?.modelCode ?? "",
    item.brand?.name ?? ""
  ].join(" ");
  return /羽毛球|亚狮龙|rsl|as-50|as-40|as-30|超牌|威肯|翎美|精彩永恒/i.test(seed);
}

function displayPurchaseName(item: Pick<PurchaseRow, "itemNameSnapshot" | "category" | "gearItem" | "brand">) {
  return canonicalProductName({
    name: item.itemNameSnapshot,
    brandName: item.brand?.name ?? "",
    modelCode: item.gearItem?.modelCode ?? "",
    categoryName: item.category?.name ?? ""
  });
}

function displayPurchaseBrand(item: Pick<PurchaseRow, "brand">) {
  const brandName = canonicalOptionalBrandDisplayName(item.brand?.name);
  return brandName || "-";
}

function catalogSuggestionKey(item: Pick<CatalogSuggestion, "name" | "brandName" | "modelCode" | "categoryName">) {
  return canonicalProductKey({
    name: item.name,
    brandName: item.brandName,
    modelCode: item.modelCode,
    categoryName: item.categoryName
  });
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
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryCategoryId, setLibraryCategoryId] = useState("");
  const [libraryView, setLibraryView] = useState<"list" | "card">("card");
  const [favoriteCatalogIds, setFavoriteCatalogIds] = useState<string[]>([]);
  const [favoriteCatalogsLoaded, setFavoriteCatalogsLoaded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [allowAutoImageLookup, setAllowAutoImageLookup] = useState(false);
  const [uploadingCreateImage, setUploadingCreateImage] = useState(false);
  const [createImageError, setCreateImageError] = useState<string | null>(null);
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
  const libraryItems = libraryData?.items ?? [];
  const isEntryVisible = mode === "entry" || mode === "all";
  const isLedgerVisible = mode === "ledger" || mode === "all";
  const categoryFilterItems = useMemo(
    () => [{ id: "", name: "全部" }, ...categories],
    [categories]
  );
  const selectedCreateCategoryName = useMemo(
    () => categories.find((item) => item.id === form.categoryId)?.name ?? "未分类",
    [categories, form.categoryId]
  );

  const totalPreview = useMemo(() => {
    if (form.totalPriceCny !== "") return Number(form.totalPriceCny || 0);
    return Number(form.unitPriceCny) * Number(form.quantity || 1);
  }, [form.quantity, form.totalPriceCny, form.unitPriceCny]);

  const editTotalPreview = useMemo(() => {
    if (editForm.totalPriceCny !== "") return Number(editForm.totalPriceCny || 0);
    return Number(editForm.unitPriceCny) * Number(editForm.quantity || 1);
  }, [editForm.quantity, editForm.totalPriceCny, editForm.unitPriceCny]);

  const createChannelOptions = useMemo(() => getPurchaseChannelOptions(form.channel), [form.channel]);
  const editChannelOptions = useMemo(() => getPurchaseChannelOptions(editForm.channel), [editForm.channel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PROJECT_LIBRARY_FAVORITES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFavoriteCatalogIds(parsed.filter((item): item is string => typeof item === "string"));
        }
      }
    } catch {
      // ignore corrupted local preference
    } finally {
      setFavoriteCatalogsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !favoriteCatalogsLoaded) return;
    window.localStorage.setItem(PROJECT_LIBRARY_FAVORITES_KEY, JSON.stringify(favoriteCatalogIds));
  }, [favoriteCatalogIds, favoriteCatalogsLoaded]);

  const shuttleGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        name: string;
        totalQty: number;
        usedUpQty: number;
        activeQty: number;
        latestDate: string;
      }
    >();

    for (const item of items) {
      const categoryName = item.category?.name ?? "";
      const modelCode = item.gearItem?.modelCode ?? "";
      const brandName = item.brand?.name ?? "";
      const isShuttle = isShuttleLikeRow(item);

      if (!isShuttle) continue;

      const canonicalName = canonicalProductName({
        name: item.itemNameSnapshot,
        brandName,
        modelCode,
        categoryName
      });
      const key = canonicalProductKey({
        name: item.itemNameSnapshot,
        brandName,
        modelCode,
        categoryName
      });
      const current = groups.get(key) ?? {
        name: canonicalName,
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

  const latestPurchaseAtByCatalogKey = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of items) {
      const key = canonicalProductKey({
        name: item.itemNameSnapshot,
        brandName: item.brand?.name ?? "",
        modelCode: item.gearItem?.modelCode ?? "",
        categoryName: item.category?.name ?? ""
      });
      const purchasedAt = new Date(item.purchaseDate).getTime();
      const current = map.get(key) ?? 0;
      if (purchasedAt > current) {
        map.set(key, purchasedAt);
      }
    }

    return map;
  }, [items]);

  const favoriteCatalogIdSet = useMemo(() => new Set(favoriteCatalogIds), [favoriteCatalogIds]);

  const sortedLibraryItems = useMemo(() => {
    const collator = new Intl.Collator("zh-Hans-CN");

    return [...libraryItems].sort((a, b) => {
      const favoriteDiff =
        Number(favoriteCatalogIdSet.has(b.id)) - Number(favoriteCatalogIdSet.has(a.id));
      if (favoriteDiff !== 0) return favoriteDiff;

      const recentDiff =
        (latestPurchaseAtByCatalogKey.get(catalogSuggestionKey(b)) ?? 0) -
        (latestPurchaseAtByCatalogKey.get(catalogSuggestionKey(a)) ?? 0);
      if (recentDiff !== 0) return recentDiff;

      const brandDiff = collator.compare(a.brandName || "", b.brandName || "");
      if (brandDiff !== 0) return brandDiff;

      const aPrice = typeof a.suggestedUnitPriceCny === "number" ? a.suggestedUnitPriceCny : Number.POSITIVE_INFINITY;
      const bPrice = typeof b.suggestedUnitPriceCny === "number" ? b.suggestedUnitPriceCny : Number.POSITIVE_INFINITY;
      if (aPrice !== bPrice) return aPrice - bPrice;

      const modelDiff = collator.compare(a.modelCode || "", b.modelCode || "");
      if (modelDiff !== 0) return modelDiff;

      return collator.compare(a.name, b.name);
    });
  }, [favoriteCatalogIdSet, latestPurchaseAtByCatalogKey, libraryItems]);

  const quickPickItems = useMemo(() => sortedLibraryItems.slice(0, 8), [sortedLibraryItems]);

  function toggleFavoriteCatalogItem(itemId: string) {
    setFavoriteCatalogIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [itemId, ...current]
    );
  }

  async function submit() {
    if (!form.itemNameSnapshot) return;
    setSaving(true);

    const payload = {
      ...form,
      categoryId: form.categoryId || null,
      brandName: form.brandName || null,
      modelCode: form.modelCode || null,
      gearCoverImageUrl: form.gearCoverImageUrl || null,
      channel: form.channel || null,
      notes: form.notes || null,
      totalPriceCny: form.totalPriceCny === "" ? null : Number(form.totalPriceCny),
      purchaseDate: toPurchaseIsoDate(form.purchaseDate || currentDateInputValue()),
      unitPriceCny: Number(form.unitPriceCny),
      quantity: Number(form.quantity),
      itemStatus: form.itemStatus,
      allowAutoImageLookup
    };

    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json();
      alert(`保存失败: ${errorData.detail || errorData.error || "未知错误"}`);
      setSaving(false);
      return;
    }

    setForm((prev) => ({
      ...initialForm,
      categoryId: prev.categoryId || libraryCategoryId
    }));
    setCreateOpen(false);
    setSaving(false);
    await mutatePurchases();
  }

  async function uploadCreateImage(file: File) {
    setUploadingCreateImage(true);
    setCreateImageError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data?.detail || data?.error || "上传失败");
      }

      setForm((state) => ({ ...state, gearCoverImageUrl: data.url }));
    } catch (error) {
      setCreateImageError((error as Error).message || "上传失败");
    } finally {
      setUploadingCreateImage(false);
    }
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

  async function consumeOne(item: PurchaseRow) {
    if (!(item.itemStatus === "IN_USE" || item.itemStatus === "STORED")) return;
    if (item.quantity <= 0) return;

    await fetch(`/api/purchases/${item.id}/consume-one`, {
      method: "POST"
    });
    await mutatePurchases();
  }

  function openEdit(item: PurchaseRow) {
    setEditingId(item.id);
    setEditForm({
      itemNameSnapshot: displayPurchaseName(item),
      brandName: canonicalOptionalBrandDisplayName(item.brand?.name),
      modelCode: item.gearItem?.modelCode ?? "",
      categoryId: item.categoryId ?? "",
      gearCoverImageUrl: "",
      unitPriceCny: Number(item.unitPriceCny),
      quantity: item.quantity,
      totalPriceCny: Number(item.totalPriceCny).toString(),
      purchaseDate: toDateInputValue(item.purchaseDate),
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
      gearCoverImageUrl: editForm.gearCoverImageUrl || null,
      channel: editForm.channel || null,
      notes: editForm.notes || null,
      totalPriceCny: editForm.totalPriceCny === "" ? null : Number(editForm.totalPriceCny),
      purchaseDate: toPurchaseIsoDate(editForm.purchaseDate || currentDateInputValue()),
      unitPriceCny: Number(editForm.unitPriceCny),
      quantity: Number(editForm.quantity),
      itemStatus: editForm.itemStatus
    };

    const res = await fetch(`/api/purchases/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json();
      alert(`修改失败: ${errorData.detail || errorData.error || "未知错误"}`);
      setEditingSaving(false);
      return;
    }

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
      gearCoverImageUrl: item.imageUrl ?? state.gearCoverImageUrl,
      unitPriceCny:
        typeof item.suggestedUnitPriceCny === "number" && Number.isFinite(item.suggestedUnitPriceCny)
          ? item.suggestedUnitPriceCny
          : state.unitPriceCny,
      totalPriceCny: ""
    }));
    setCreateImageError(null);
    setAllowAutoImageLookup(true);
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
      gearCoverImageUrl: item.imageUrl ?? state.gearCoverImageUrl,
      unitPriceCny: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : state.unitPriceCny,
      totalPriceCny: ""
    }));
    setCreateImageError(null);
    setAllowAutoImageLookup(true);
    setCreateOpen(true);
  }

  function openCreateModal() {
    setForm({
      ...initialForm,
      categoryId: libraryCategoryId || "",
      purchaseDate: currentDateInputValue()
    });
    setAllowAutoImageLookup(false);
    setCreateImageError(null);
    setCreateOpen(true);
  }

  function closeCreateModal() {
    setCreateImageError(null);
    setCreateOpen(false);
  }

  return (
    <div className="space-y-6">
      {isEntryVisible && (
        <>
          <ControlPanel
            right={
              <Button type="button" onClick={openCreateModal}>
                新增购买
              </Button>
            }
          >
            <SegmentedControl
              options={categoryFilterItems.map((c) => ({ id: c.id, label: c.name }))}
              value={libraryCategoryId}
              onChange={setLibraryCategoryId}
            />
          </ControlPanel>

          <Card entryAnimation={false} className="min-h-[78vh]">
            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]">
              <Input
                value={libraryQuery}
                onChange={(event) => {
                  setLibraryQuery(event.target.value);
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
              {quickPickItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rounded-lg border border-border bg-panel px-3 py-1.5 text-xs text-mute transition hover:border-accent/55 hover:text-text"
                  onClick={() => applySuggestion(item)}
                >
                  {item.name}
                </button>
              ))}
              {!libraryLoading && !quickPickItems.length ? (
                <span className="text-xs text-mute">暂无快捷推荐</span>
              ) : null}
            </div>

            <div className="mt-4 h-[66vh] overflow-y-auto rounded-xl border border-border bg-panel-2">
              {libraryItems.length ? (
                libraryView === "list" ? (
                  <div className="divide-y divide-border">
                    {sortedLibraryItems.map((item) => {
                      const latestPrice = Number(item.suggestedUnitPriceCny ?? Number.NaN);
                      const recentPurchasedAt = latestPurchaseAtByCatalogKey.get(catalogSuggestionKey(item));
                      const isFavorite = favoriteCatalogIdSet.has(item.id);
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition hover:bg-panel"
                          onClick={() => applyLibraryItem(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              applyLibraryItem(item);
                            }
                          }}
                        >
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="h-14 w-14 rounded-md border border-border object-contain bg-panel-2"
                            />
                          ) : (
                            <div className="h-14 w-14 rounded-md border border-dashed border-border" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-text">{item.name}</div>
                            <div className="truncate text-xs text-mute">
                              {(item.brandName || "未知品牌") + " · " + (item.modelCode || "无型号") + " · " + (item.categoryName || "未分类")}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-text-mute">
                              {isFavorite ? <span className="rounded-full border border-accent/35 bg-accent/12 px-2 py-0.5 text-accent">已收藏</span> : null}
                              {recentPurchasedAt ? <span className="rounded-full border border-border px-2 py-0.5">最近买过</span> : null}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`rounded-full border px-2 py-1 text-xs transition ${isFavorite
                              ? "border-accent/35 bg-accent/12 text-accent"
                              : "border-border text-text-mute hover:border-accent/35 hover:text-accent"
                              }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavoriteCatalogItem(item.id);
                            }}
                          >
                            {isFavorite ? "已收藏" : "收藏"}
                          </button>
                          <div className="text-right">
                            <div className="text-xs text-mute">参考价</div>
                            <div className="text-sm text-text">{Number.isFinite(latestPrice) && latestPrice > 0 ? currency(latestPrice) : "-"}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {sortedLibraryItems.map((item) => {
                      const latestPrice = Number(item.suggestedUnitPriceCny ?? Number.NaN);
                      const recentPurchasedAt = latestPurchaseAtByCatalogKey.get(catalogSuggestionKey(item));
                      const isFavorite = favoriteCatalogIdSet.has(item.id);
                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          className="group relative h-full cursor-pointer rounded-2xl border border-border bg-panel p-4 text-left transition-all duration-300 hover:border-accent/35"
                          onClick={() => applyLibraryItem(item)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              applyLibraryItem(item);
                            }
                          }}
                        >
                          <button
                            type="button"
                            aria-label={isFavorite ? "取消收藏" : "收藏"}
                            className={`absolute right-3 top-3 z-10 rounded-full border px-2.5 py-1 text-[11px] transition ${isFavorite
                              ? "border-accent/35 bg-accent/12 text-accent"
                              : "border-border bg-panel/92 text-text-mute hover:border-accent/35 hover:text-accent"
                              }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavoriteCatalogItem(item.id);
                            }}
                          >
                            {isFavorite ? "已收藏" : "收藏"}
                          </button>
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
                              <div className="flex flex-wrap gap-1.5 text-[11px] text-text-mute">
                                {isFavorite ? <span className="rounded-full border border-accent/35 bg-accent/12 px-2 py-0.5 text-accent">已收藏</span> : null}
                                {recentPurchasedAt ? <span className="rounded-full border border-border px-2 py-0.5">最近买过</span> : null}
                              </div>
                              <div className="text-sm font-semibold text-text">
                                {Number.isFinite(latestPrice) && latestPrice > 0 ? currency(latestPrice) : "-"}
                              </div>
                            </div>
                          </div>
                        </div>
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
        </>
      )}

      {isEntryVisible && createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="max-h-[92vh] w-full max-w-5xl overflow-y-auto">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl text-neon">新增购买记录</h2>
              <Button type="button" variant="ghost" onClick={closeCreateModal}>
                关闭
              </Button>
            </div>
            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-[28px] border border-border bg-panel/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-mute">装备照片</div>
                      <div className="mt-1 text-sm text-text-mute">创建时会写入装备封面</div>
                    </div>
                    <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-text-mute">
                      {selectedCreateCategoryName}
                    </span>
                  </div>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] border border-border bg-panel-2">
                    {form.gearCoverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.gearCoverImageUrl}
                        alt={form.itemNameSnapshot || "装备图片预览"}
                        className="h-full w-full object-contain p-4"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <div className="rounded-full border border-dashed border-border px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mute">
                          no preview
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text">手动新增默认不绑定照片</p>
                          <p className="mt-1 text-xs leading-6 text-text-mute">
                            可直接上传一张装备图作为封面，也可以先保存，后续在详情页补图。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 space-y-3">
                    <label className="block">
                      <span className="mb-1.5 block text-xs uppercase tracking-widest text-mute">上传图片</span>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void uploadCreateImage(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <div>
                      <label className="mb-1.5 block text-xs uppercase tracking-widest text-mute">图片 URL</label>
                      <Input
                        value={form.gearCoverImageUrl}
                        onChange={(event) => {
                          setCreateImageError(null);
                          setForm((state) => ({ ...state, gearCoverImageUrl: event.target.value }));
                        }}
                        placeholder="https://... 或 /gear-images/..."
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {uploadingCreateImage ? <span className="text-accent">图片上传中...</span> : null}
                      {createImageError ? <span className="text-danger">{createImageError}</span> : null}
                      {!uploadingCreateImage && !createImageError && form.gearCoverImageUrl ? (
                        <span className="text-text-mute">当前预览即将作为该装备的封面图</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2">
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
                    onChange={(event) =>
                      setForm((s) => {
                        const nextTotal = event.target.value;
                        if (nextTotal === "") {
                          return { ...s, totalPriceCny: "" };
                        }

                        const total = Number(nextTotal);
                        const quantity = Number(s.quantity);
                        if (!Number.isFinite(total) || total < 0 || !Number.isFinite(quantity) || quantity <= 0) {
                          return { ...s, totalPriceCny: nextTotal };
                        }

                        return {
                          ...s,
                          totalPriceCny: nextTotal,
                          unitPriceCny: Number((total / quantity).toFixed(2))
                        };
                      })
                    }
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-widest text-mute">购买时间</label>
                  <Input
                    type="date"
                    value={form.purchaseDate}
                    onChange={(event) => setForm((s) => ({ ...s, purchaseDate: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs uppercase tracking-widest text-mute">渠道</label>
                  <Select
                    value={form.channel}
                    onChange={(event) => setForm((s) => ({ ...s, channel: event.target.value }))}
                  >
                    <option value="">未填写</option>
                    {createChannelOptions.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </Select>
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
                    rows={3}
                    value={form.notes}
                    onChange={(event) => setForm((s) => ({ ...s, notes: event.target.value }))}
                  />
                </div>
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
        <Card entryAnimation={false}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl text-neon">购买记录</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-mute tabular-nums">{items.length} 条记录</span>
              <div className="flex items-center gap-2">
                <a
                  className="rounded-xl border border-border bg-panel px-3 py-2 text-xs font-medium text-text transition hover:bg-border/40 hover:shadow-sm"
                  href="/api/purchases/export"
                >
                  导出 CSV
                </a>
                <label className="cursor-pointer rounded-xl border border-border bg-panel px-3 py-2 text-xs font-medium text-text transition hover:bg-border/40 hover:shadow-sm">
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
          </div>

          {loading ? (
            <div className="py-6">
              <TableSkeleton rows={8} cols={10} />
            </div>
          ) : (
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b-2">
                  <TableHead>日期</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>型号</TableHead>
                  <TableHead>品牌</TableHead>
                  <TableHead>品类</TableHead>
                  <TableHead className="w-32">状态</TableHead>
                  <TableHead className="text-right">单价</TableHead>
                  <TableHead className="text-right">数量</TableHead>
                  <TableHead className="text-right">总价</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-mute tabular-nums">{dateText(item.purchaseDate)}</TableCell>
                    <TableCell className="font-medium">{displayPurchaseName(item)}</TableCell>
                    <TableCell className="text-mute font-mono text-xs">{item.gearItem?.modelCode ?? "-"}</TableCell>
                    <TableCell>{displayPurchaseBrand(item)}</TableCell>
                    <TableCell>
                      <Badge variant="neutral" className="font-normal opacity-80">
                        {item.category?.name ?? "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Select
                        className="h-8 py-0 text-xs"
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
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{currency(Number(item.unitPriceCny))}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{item.quantity}</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-neon">
                      {currency(Number(item.totalPriceCny))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {isShuttleLikeRow(item) && (item.itemStatus === "IN_USE" || item.itemStatus === "STORED") && item.quantity > 0 ? (
                          <Button size="sm" variant="secondary" type="button" onClick={() => void consumeOne(item)}>
                            {item.quantity > 1 ? "用完1" : "用完"}
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" type="button" onClick={() => openEdit(item)}>
                          编辑
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
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
                  onChange={(event) =>
                    setEditForm((s) => {
                      const nextTotal = event.target.value;
                      if (nextTotal === "") {
                        return { ...s, totalPriceCny: "" };
                      }

                      const total = Number(nextTotal);
                      const quantity = Number(s.quantity);
                      if (!Number.isFinite(total) || total < 0 || !Number.isFinite(quantity) || quantity <= 0) {
                        return { ...s, totalPriceCny: nextTotal };
                      }

                      return {
                        ...s,
                        totalPriceCny: nextTotal,
                        unitPriceCny: Number((total / quantity).toFixed(2))
                      };
                    })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">购买时间</label>
                <Input
                  type="date"
                  value={editForm.purchaseDate}
                  onChange={(event) => setEditForm((s) => ({ ...s, purchaseDate: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase tracking-widest text-mute">渠道</label>
                <Select
                  value={editForm.channel}
                  onChange={(event) => setEditForm((s) => ({ ...s, channel: event.target.value }))}
                >
                  <option value="">未填写</option>
                  {createChannelOptions.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </Select>
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
        <Card entryAnimation={false} className="overflow-hidden p-0 sm:p-0 border-none bg-transparent shadow-none">
          <div className="mb-4 flex items-center justify-between px-1">
            <div>
              <h2 className="font-display text-xl text-text font-bold tracking-tight">羽毛球存量监控</h2>
              <span className="text-xs text-mute mt-1 block">按球型号聚合新购与消耗情况</span>
            </div>
          </div>
          <div className="space-y-3">
            {shuttleGroups.map((group) => {
              const usagePercent = group.totalQty > 0 ? (group.usedUpQty / group.totalQty) * 100 : 0;
              return (
                <div key={group.name} className="relative overflow-hidden rounded-[24px] border border-border bg-panel-2 p-5 shadow-sm transition-all hover:border-accent/40 hover:shadow-md group">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative z-10">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-accent/10 text-accent font-display text-lg font-bold shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] group-hover:scale-110 transition-transform duration-500">
                        {group.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-text text-base tracking-tight">{group.name}</h3>
                        <p className="text-xs text-text-mute mt-0.5 tracking-wider uppercase">上次采购于 {dateText(group.latestDate)}</p>
                      </div>
                    </div>

                    <div className="flex flex-1 items-center justify-end gap-6 md:gap-10">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-bold tracking-widest text-mute mb-1">余量</div>
                        <div className="font-display text-2xl font-bold text-accent leading-none tabular-nums">
                          {group.activeQty}
                        </div>
                      </div>

                      <div className="w-[120px] shrink-0">
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-semibold mb-1.5">
                          <span className="text-mute">已消耗</span>
                          <span className="text-text">{group.usedUpQty} / {group.totalQty}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border shadow-inner">
                          <div
                            className="h-full rounded-full bg-text transition-all duration-1000 ease-out"
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
