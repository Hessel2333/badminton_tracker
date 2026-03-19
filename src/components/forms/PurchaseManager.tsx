"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ControlPanel } from "@/components/ui/ControlPanel";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SmartImage } from "@/components/ui/SmartImage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { fetchJsonWithPerf } from "@/lib/client/fetch-json-with-perf";
import {
  canonicalOptionalBrandDisplayName,
  canonicalProductKey,
  canonicalProductName
} from "@/lib/business-rules";
import { getPurchaseChannelOptions } from "@/lib/purchase-options";
import { currency, dateText } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";

type Category = {
  id: string;
  name: string;
};

type PurchaseRow = {
  id: string;
  brandId?: string | null;
  categoryId?: string | null;
  itemNameSnapshot: string;
  gearItem?: { id: string; modelCode?: string | null; coverImageUrl?: string | null } | null;
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

type WishlistSourceItem = {
  id: string;
  categoryId?: string | null;
  name: string;
  priority: number;
  status: "WANT" | "WATCHING" | "PURCHASED" | "DROPPED";
  targetPriceCny?: number | string | null;
  currentSeenPriceCny?: number | string | null;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  brand?: { name: string } | null;
  category?: { name: string } | null;
};

type PurchaseManagerMode = "entry" | "ledger" | "all";

function isLibraryView(value: unknown): value is "list" | "card" {
  return value === "list" || value === "card";
}

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

function extractApiErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "未知错误";

  const candidate = payload as {
    detail?: unknown;
    error?: unknown;
  };

  if (typeof candidate.detail === "string" && candidate.detail.trim()) {
    return candidate.detail;
  }

  if (typeof candidate.error === "string" && candidate.error.trim()) {
    return candidate.error;
  }

  if (candidate.error && typeof candidate.error === "object") {
    const fieldErrors = (candidate.error as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors;
    if (fieldErrors) {
      const firstMessage = Object.values(fieldErrors).flat().find((item): item is string => Boolean(item));
      if (firstMessage) return firstMessage;
    }
  }

  return "未知错误";
}

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

function wishlistCatalogKey(item: Pick<CatalogSuggestion, "name" | "brandName" | "categoryName">) {
  return canonicalProductKey({
    name: item.name,
    brandName: item.brandName,
    modelCode: "",
    categoryName: item.categoryName
  });
}

export function PurchaseManager({
  fallbackPurchases,
  fallbackCategories,
  fallbackCatalogItems,
  fallbackWishlist,
  mode = "all"
}: {
  fallbackPurchases?: PurchaseRow[];
  fallbackCategories?: Category[];
  fallbackCatalogItems?: CatalogSuggestion[];
  fallbackWishlist?: WishlistSourceItem[];
  mode?: PurchaseManagerMode;
} = {}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PurchaseForm>(initialForm);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryCategoryId, setLibraryCategoryId] = useState("");
  const [libraryView, setLibraryView] = useSessionStorageState<"list" | "card">(
    `purchase-library-view:${mode}`,
    "card",
    isLibraryView
  );
  const [wishlistOnly, setWishlistOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<CatalogSuggestion | null>(null);
  const [wishlistSourceItem, setWishlistSourceItem] = useState<WishlistSourceItem | null>(null);
  const [addingWishlistId, setAddingWishlistId] = useState<string | null>(null);
  const [allowAutoImageLookup, setAllowAutoImageLookup] = useState(false);
  const [uploadingCreateImage, setUploadingCreateImage] = useState(false);
  const [createImageError, setCreateImageError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<PurchaseForm>(initialForm);
  const [editingSaving, setEditingSaving] = useState(false);
  const debouncedLibraryQuery = useDebouncedValue(libraryQuery, 220);

  const { data: purchaseData, isLoading: purchaseLoading, mutate: mutatePurchases } =
    useSWR<{ items: PurchaseRow[] }>("/api/purchases?pageSize=80", fetchJsonWithPerf, {
      fallbackData: fallbackPurchases ? { items: fallbackPurchases } : undefined,
      revalidateIfStale: !fallbackPurchases,
      revalidateOnMount: !fallbackPurchases
    });
  const { data: categoryData } =
    useSWR<{ items: Category[] }>("/api/settings/categories", fetchJsonWithPerf, {
      fallbackData: fallbackCategories ? { items: fallbackCategories } : undefined,
      revalidateIfStale: !fallbackCategories,
      revalidateOnMount: !fallbackCategories
    });
  const libraryUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("scope", "project");
    params.set("limit", "240");
    if (libraryCategoryId) params.set("categoryId", libraryCategoryId);
    if (debouncedLibraryQuery.trim()) params.set("q", debouncedLibraryQuery.trim());
    return `/api/catalog?${params.toString()}`;
  }, [debouncedLibraryQuery, libraryCategoryId]);
  const { data: libraryData, isLoading: libraryLoading } =
    useSWR<{ items: CatalogSuggestion[] }>(libraryUrl, fetchJsonWithPerf, {
      fallbackData:
        fallbackCatalogItems && !libraryCategoryId && !debouncedLibraryQuery.trim()
          ? { items: fallbackCatalogItems }
          : undefined,
      revalidateIfStale: !(fallbackCatalogItems && !libraryCategoryId && !debouncedLibraryQuery.trim()),
      revalidateOnMount: !(fallbackCatalogItems && !libraryCategoryId && !debouncedLibraryQuery.trim())
    });
  const { data: wishlistData, mutate: mutateWishlist } =
    useSWR<{ items: WishlistSourceItem[] }>("/api/wishlist", fetchJsonWithPerf, {
      fallbackData: fallbackWishlist ? { items: fallbackWishlist } : undefined,
      revalidateIfStale: !fallbackWishlist,
      revalidateOnMount: !fallbackWishlist
    });

  const items = purchaseData?.items ?? [];
  const categories = categoryData?.items ?? [];
  const loading = purchaseLoading;
  const libraryItems = libraryData?.items ?? [];
  const wishlistItems = wishlistData?.items ?? [];
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
  const isPresetCreateSource = Boolean(selectedCatalogItem || wishlistSourceItem);
  const activeWishlistItems = useMemo(
    () =>
      [...wishlistItems]
        .filter((item) => item.status === "WANT" || item.status === "WATCHING")
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          const aSeen = Number(a.currentSeenPriceCny ?? Number.POSITIVE_INFINITY);
          const bSeen = Number(b.currentSeenPriceCny ?? Number.POSITIVE_INFINITY);
          if (Number.isFinite(aSeen) || Number.isFinite(bSeen)) return aSeen - bSeen;
          return a.name.localeCompare(b.name, "zh-Hans-CN");
        }),
    [wishlistItems]
  );
  const wishlistKeys = useMemo(
    () =>
      new Set(
        activeWishlistItems.map((item) =>
          canonicalProductKey({
            name: item.name,
            brandName: item.brand?.name ?? "",
            modelCode: "",
            categoryName: item.category?.name ?? ""
          })
        )
      ),
    [activeWishlistItems]
  );
  const wishlistItemByKey = useMemo(
    () =>
      new Map(
        activeWishlistItems.map((item) => [
          canonicalProductKey({
            name: item.name,
            brandName: item.brand?.name ?? "",
            modelCode: "",
            categoryName: item.category?.name ?? ""
          }),
          item
        ])
      ),
    [activeWishlistItems]
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

  const sortedLibraryItems = useMemo(() => {
    const collator = new Intl.Collator("zh-Hans-CN");

    return [...libraryItems].sort((a, b) => {
      const wishlistDiff =
        Number(wishlistKeys.has(catalogSuggestionKey(b))) - Number(wishlistKeys.has(catalogSuggestionKey(a)));
      if (wishlistDiff !== 0) return wishlistDiff;

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
  }, [latestPurchaseAtByCatalogKey, libraryItems, wishlistKeys]);
  const visibleLibraryItems = useMemo(
    () =>
      wishlistOnly
        ? sortedLibraryItems.filter((item) => wishlistItemByKey.has(wishlistCatalogKey(item)))
        : sortedLibraryItems,
    [sortedLibraryItems, wishlistItemByKey, wishlistOnly]
  );

  const quickPickItems = useMemo(() => visibleLibraryItems.slice(0, 8), [visibleLibraryItems]);

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

    const endpoint = wishlistSourceItem
      ? `/api/wishlist/${wishlistSourceItem.id}/convert-to-purchase`
      : "/api/purchases";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorData = await res.json();
      alert(`保存失败: ${extractApiErrorMessage(errorData)}`);
      setSaving(false);
      return;
    }

    setForm((prev) => ({
      ...initialForm,
      categoryId: prev.categoryId || libraryCategoryId
    }));
    setCreateOpen(false);
    setSelectedCatalogItem(null);
    setWishlistSourceItem(null);
    setSaving(false);
    await Promise.all([mutatePurchases(), mutateWishlist()]);
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
      gearCoverImageUrl: item.gearItem?.coverImageUrl ?? "",
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
      alert(`修改失败: ${extractApiErrorMessage(errorData)}`);
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

  function applyLibraryItem(item: CatalogSuggestion) {
    setSelectedCatalogItem(item);
    setWishlistSourceItem(null);
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

  async function addCatalogItemToWishlist(item: CatalogSuggestion) {
    const key = wishlistCatalogKey(item);
    if (wishlistKeys.has(key)) return;

    setAddingWishlistId(item.id);
    const res = await fetch("/api/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: item.name,
        brandName: item.brandName || null,
        categoryId: item.categoryId || null,
        targetPriceCny:
          typeof item.suggestedUnitPriceCny === "number" && Number.isFinite(item.suggestedUnitPriceCny)
            ? item.suggestedUnitPriceCny
            : null,
        currentSeenPriceCny:
          typeof item.suggestedUnitPriceCny === "number" && Number.isFinite(item.suggestedUnitPriceCny)
            ? item.suggestedUnitPriceCny
            : null,
        priority: 3,
        status: "WANT",
        imageUrl: item.imageUrl ?? null,
        notes: null
      })
    });

    if (!res.ok) {
      const errorData = await res.json();
      alert(`加入心愿单失败: ${extractApiErrorMessage(errorData)}`);
      setAddingWishlistId(null);
      return;
    }

    setAddingWishlistId(null);
    await mutateWishlist();
  }

  async function removeCatalogItemFromWishlist(item: CatalogSuggestion) {
    const wishlistItem = wishlistItemByKey.get(wishlistCatalogKey(item));
    if (!wishlistItem) return;

    setAddingWishlistId(item.id);
    const res = await fetch(`/api/wishlist/${wishlistItem.id}`, {
      method: "DELETE"
    });

    if (!res.ok) {
      const errorData = await res.json();
      alert(`移出心愿单失败: ${extractApiErrorMessage(errorData)}`);
      setAddingWishlistId(null);
      return;
    }

    setAddingWishlistId(null);
    await mutateWishlist();
  }

  function openCreateModal() {
    setSelectedCatalogItem(null);
    setWishlistSourceItem(null);
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
    setSelectedCatalogItem(null);
    setWishlistSourceItem(null);
  }

  return (
    <div className="space-y-6">
      {isEntryVisible && (
        <>
          <ControlPanel
            right={
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  onClick={() => setWishlistOnly((current) => !current)}
                  variant="secondary"
                  className={[
                    "w-full sm:min-w-[9.75rem] sm:w-auto px-5",
                    wishlistOnly
                      ? "border-accent/20 bg-accent/10 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                      : ""
                  ].join(" ")}
                >
                  {wishlistOnly ? "查看全部装备" : `查看心愿单${activeWishlistItems.length ? ` (${activeWishlistItems.length})` : ""}`}
                </Button>
                <Button type="button" onClick={openCreateModal} className="w-full px-5 sm:min-w-[8.75rem] sm:w-auto">
                  手动新增
                </Button>
              </div>
            }
          >
            <SegmentedControl
              options={categoryFilterItems.map((c) => ({ id: c.id, label: c.name }))}
              value={libraryCategoryId}
              onChange={setLibraryCategoryId}
              className="w-full overflow-x-auto [&::-webkit-scrollbar]:hidden sm:w-fit"
            />
          </ControlPanel>

          <Card entryAnimation={false}>
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
                  onClick={() => setLibraryQuery(item.name)}
                >
                  {item.name}
                </button>
              ))}
              {!libraryLoading && !quickPickItems.length ? (
                <span className="text-xs text-mute">{wishlistOnly ? "心愿单筛选下暂无装备" : "暂无快捷推荐"}</span>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-panel-2">
              {visibleLibraryItems.length ? (
                libraryView === "list" ? (
                  <div className="divide-y divide-border">
                    {visibleLibraryItems.map((item, index) => {
                      const latestPrice = Number(item.suggestedUnitPriceCny ?? Number.NaN);
                      const recentPurchasedAt = latestPurchaseAtByCatalogKey.get(catalogSuggestionKey(item));
                      const inWishlist = wishlistItemByKey.has(wishlistCatalogKey(item));
                      const addingToWishlist = addingWishlistId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="flex flex-col gap-3 px-4 py-3 text-left transition hover:bg-panel sm:flex-row sm:items-center"
                        >
                          {item.imageUrl ? (
                            <div className="relative h-14 w-14 overflow-hidden rounded-md border border-border bg-panel-2">
                              <SmartImage
                                src={item.imageUrl}
                                alt={item.name}
                                fill
                                sizes="56px"
                                priority={index < 6}
                                loading={index < 10 ? "eager" : "lazy"}
                                className="object-contain"
                              />
                            </div>
                          ) : (
                            <div className="h-14 w-14 rounded-md border border-dashed border-border" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-text">{item.name}</div>
                            <div className="truncate text-xs text-mute">
                              {(item.brandName || "未知品牌") + " · " + (item.modelCode || "无型号") + " · " + (item.categoryName || "未分类")}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-text-mute">
                              {recentPurchasedAt ? <span className="rounded-full border border-border px-2 py-0.5">最近买过</span> : null}
                              {inWishlist ? <span className="rounded-full border border-accent/35 bg-accent/12 px-2 py-0.5 text-accent">已在心愿单</span> : null}
                            </div>
                          </div>
                          <div className="flex w-full flex-col gap-2 sm:ml-auto sm:min-w-[250px] sm:w-auto sm:items-end">
                            <div className="sm:text-right">
                              <div className="text-xs text-mute">参考价</div>
                              <div className="text-sm text-text">{Number.isFinite(latestPrice) && latestPrice > 0 ? currency(latestPrice) : "-"}</div>
                            </div>
                            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                              <Button type="button" size="sm" className="w-full sm:w-auto" onClick={() => applyLibraryItem(item)}>
                                新增购买
                              </Button>
                              {inWishlist ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="w-full sm:w-auto"
                                  onClick={() => void removeCatalogItemFromWishlist(item)}
                                  disabled={addingToWishlist}
                                >
                                  {addingToWishlist ? "移出中..." : "移出心愿单"}
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="w-full sm:w-auto"
                                  onClick={() => void addCatalogItemToWishlist(item)}
                                  disabled={addingToWishlist}
                                >
                                  {addingToWishlist ? "加入中..." : "加入心愿单"}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {visibleLibraryItems.map((item, index) => {
                      const latestPrice = Number(item.suggestedUnitPriceCny ?? Number.NaN);
                      const recentPurchasedAt = latestPurchaseAtByCatalogKey.get(catalogSuggestionKey(item));
                      const inWishlist = wishlistItemByKey.has(wishlistCatalogKey(item));
                      const addingToWishlist = addingWishlistId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="group relative h-full rounded-2xl border border-border bg-panel p-4 text-left transition-all duration-300 hover:border-accent/35"
                        >
                          <div className="space-y-3">
                            <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-panel-2 shadow-inner">
                              {item.imageUrl ? (
                                <SmartImage
                                  src={item.imageUrl}
                                  alt={item.name}
                                  fill
                                  sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
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
                              <div className="flex items-center justify-between gap-3 pt-0.5">
                                <div className="text-sm font-semibold text-text">
                                  {Number.isFinite(latestPrice) && latestPrice > 0 ? currency(latestPrice) : "-"}
                                </div>
                                {recentPurchasedAt ? (
                                  <span className="shrink-0 text-[11px] text-text-mute">最近买过</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                className="min-h-8 flex-1 px-3 text-[12px]"
                                onClick={() => applyLibraryItem(item)}
                              >
                                新增购买
                              </Button>
                              {inWishlist ? (
                                <button
                                  type="button"
                                  className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-accent/18 bg-accent/8 px-3 text-[12px] font-medium text-accent transition-colors hover:border-accent/30 hover:bg-accent/12"
                                  onClick={() => void removeCatalogItemFromWishlist(item)}
                                  disabled={addingToWishlist}
                                >
                                  {addingToWishlist ? "移出中..." : "移出心愿单"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-border bg-panel-2 px-3 text-[12px] font-medium text-text-mute shadow-[inset_0_1px_0_var(--glass-border)] transition-colors hover:border-[var(--border-strong)] hover:text-text"
                                  onClick={() => void addCatalogItemToWishlist(item)}
                                  disabled={addingToWishlist}
                                >
                                  {addingToWishlist ? "加入中..." : "加入心愿单"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div className="flex min-h-[18rem] items-center justify-center px-3 text-sm text-mute">
                  {libraryLoading ? "加载装备库中..." : wishlistOnly ? "心愿单里还没有装备" : "暂无匹配装备"}
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {isEntryVisible && createOpen ? (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-4">
          <Card className="h-full w-full overflow-y-auto rounded-none border-x-0 border-b-0 px-4 py-5 md:max-h-[92vh] md:max-w-6xl md:rounded-[28px] md:border md:px-7 md:py-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[1.75rem] leading-none text-neon">新增购买记录</h2>
                <p className="mt-2 text-sm text-text-mute">
                  {isPresetCreateSource && form.itemNameSnapshot
                    ? `为「${form.itemNameSnapshot}」补充价格、数量、时间与渠道信息。`
                    : "补全成交信息后，这件装备就会进入你的档案。"}
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={closeCreateModal}>
                关闭
              </Button>
            </div>
            {wishlistSourceItem ? (
              <div className="mb-4 rounded-[24px] border border-accent/18 bg-accent/[0.06] px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="accent">来自心愿单</Badge>
                  <span className="text-sm text-text">
                    保存后会将「{wishlistSourceItem.name}」同步标记为已购。
                  </span>
                </div>
                <p className="mt-2 text-xs leading-6 text-text-mute">
                  这里优先补价格、数量、状态和日期；名称、品牌、分类和图片已经从心愿单带入，可按实际成交再微调。
                </p>
              </div>
            ) : null}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <div className="rounded-[28px] border border-border bg-panel/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-[0.28em] text-mute">装备信息</div>
                    <p className="mt-2 text-sm text-text-mute">
                      {isPresetCreateSource
                        ? "这些信息已从装备库带入并锁定，若需要修正基础资料，请到设置中维护。"
                        : "确认这件装备的名称、品牌和分类，避免后续档案归类混乱。"}
                    </p>
                  </div>
                  {isPresetCreateSource ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="rounded-[22px] border border-border bg-panel-2 px-4 py-3 md:col-span-2">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-mute">装备名称</div>
                        <div className="mt-2 text-base font-medium text-text">{form.itemNameSnapshot || "-"}</div>
                      </div>
                      <div className="rounded-[22px] border border-border bg-panel-2 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-mute">品牌</div>
                        <div className="mt-2 text-base font-medium text-text">{form.brandName || "-"}</div>
                      </div>
                      <div className="rounded-[22px] border border-border bg-panel-2 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-mute">型号</div>
                        <div className="mt-2 text-base font-medium text-text">{form.modelCode || "-"}</div>
                      </div>
                      <div className="rounded-[22px] border border-border bg-panel-2 px-4 py-3">
                        <div className="text-[11px] uppercase tracking-[0.22em] text-mute">品类</div>
                        <div className="mt-2 text-base font-medium text-text">{selectedCreateCategoryName}</div>
                      </div>
                    </div>
                  ) : (
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
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-border bg-panel/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-mute">购买信息</div>
                      <p className="mt-2 text-sm text-text-mute">先补金额和数量，再确认时间、渠道和当前状态。</p>
                    </div>
                    <div className="rounded-[20px] border border-accent/16 bg-accent/[0.05] px-4 py-3 text-right">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-mute">预估总价</div>
                      <div className="mt-1 text-xl font-semibold text-text">{currency(totalPreview)}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                  </div>
                </div>

                <div className="rounded-[28px] border border-border bg-panel/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-[0.28em] text-mute">备注</div>
                    <p className="mt-2 text-sm text-text-mute">只写对后续判断有帮助的信息，例如入手原因、版本差异或实际体验。</p>
                  </div>
                  <Textarea
                    rows={4}
                    value={form.notes}
                    onChange={(event) => setForm((s) => ({ ...s, notes: event.target.value }))}
                    placeholder="可选"
                  />
                </div>
              </div>

              <aside className="space-y-4">
                <div className="overflow-hidden rounded-[28px] border border-border bg-panel/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-mute">封面图</div>
                      <div className="mt-1 text-sm text-text-mute">
                        {isPresetCreateSource ? "已从装备库带入，当前记录中不可编辑。" : "可选，保存后也能再补。"}
                      </div>
                    </div>
                    <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-text-mute">
                      {selectedCreateCategoryName}
                    </span>
                  </div>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] border border-border bg-panel-2">
                    {form.gearCoverImageUrl ? (
                      <SmartImage
                        src={form.gearCoverImageUrl}
                        alt={form.itemNameSnapshot || "装备图片预览"}
                        fill
                        sizes="(max-width: 768px) 100vw, 320px"
                        className="h-full w-full object-contain p-4"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <div className="rounded-full border border-dashed border-border px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mute">
                          no preview
                        </div>
                        <p className="text-xs leading-6 text-text-mute">
                          暂时没有封面图也可以先保存记录。
                        </p>
                      </div>
                    )}
                  </div>
                  {isPresetCreateSource ? (
                    <div className="mt-4 rounded-[22px] border border-border bg-panel-2 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-mute">说明</div>
                      <p className="mt-2 text-sm leading-6 text-text-mute">
                        基础资料与封面图已固定带入。若发现型号、品类或图片有误，请前往设置中维护装备库数据。
                      </p>
                    </div>
                  ) : (
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
                          <span className="text-text-mute">当前预览会写入该装备封面</span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-mute">保存后会新增一条购买记录，并同步刷新项目档案。</div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <Button type="button" variant="secondary" onClick={closeCreateModal} className="w-full sm:min-w-[6.5rem] sm:w-auto">
                  取消
                </Button>
                <Button type="button" onClick={submit} disabled={saving} className="w-full sm:min-w-[8.5rem] sm:w-auto">
                  {saving ? "保存中..." : "保存记录"}
                </Button>
              </div>
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
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-4">
          <Card className="h-full w-full overflow-y-auto rounded-none border-x-0 border-b-0 px-4 py-5 md:max-h-[92vh] md:max-w-6xl md:rounded-[28px] md:border md:px-7 md:py-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-[1.75rem] leading-none text-neon">编辑购买记录</h2>
                <p className="mt-2 text-sm text-text-mute">
                  为「{editForm.itemNameSnapshot || "当前记录"}」调整成交信息与当前状态。
                </p>
              </div>
              <Button type="button" variant="ghost" onClick={closeEdit}>
                关闭
              </Button>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-5">
                <div className="rounded-[28px] border border-border bg-panel/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-4">
                    <div className="text-xs uppercase tracking-[0.28em] text-mute">装备信息</div>
                    <p className="mt-2 text-sm text-text-mute">这里沿用新增购买的结构，便于回头修正品牌、型号和分类。</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div className="md:col-span-2">
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
                  </div>
                </div>

                <div className="rounded-[28px] border border-border bg-panel/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-mute">购买信息</div>
                      <p className="mt-2 text-sm text-text-mute">更新金额、数量、时间、渠道和状态，档案时间线会随之同步。</p>
                    </div>
                    <div className="rounded-[20px] border border-accent/16 bg-accent/[0.05] px-4 py-3 text-right">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-mute">预估总价</div>
                      <div className="mt-1 text-xl font-semibold text-text">{currency(editTotalPreview)}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                        {editChannelOptions.map((channel) => (
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
                  </div>
                </div>

                <div className="rounded-[28px] border border-border bg-panel/78 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-3">
                    <div className="text-xs uppercase tracking-[0.28em] text-mute">备注</div>
                    <p className="mt-2 text-sm text-text-mute">保留能帮助回看这次购买判断的信息。</p>
                  </div>
                  <Textarea
                    rows={4}
                    value={editForm.notes}
                    onChange={(event) => setEditForm((s) => ({ ...s, notes: event.target.value }))}
                    placeholder="可选"
                  />
                </div>
              </div>

              <aside className="space-y-4">
                <div className="overflow-hidden rounded-[28px] border border-border bg-panel/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.28em] text-mute">封面图</div>
                      <div className="mt-1 text-sm text-text-mute">沿用当前装备封面。</div>
                    </div>
                    <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-text-mute">
                      {categories.find((item) => item.id === editForm.categoryId)?.name ?? "未分类"}
                    </span>
                  </div>
                  <div className="relative aspect-[4/5] overflow-hidden rounded-[22px] border border-border bg-panel-2">
                    {editForm.gearCoverImageUrl ? (
                      <SmartImage
                        src={editForm.gearCoverImageUrl}
                        alt={editForm.itemNameSnapshot || "装备图片预览"}
                        fill
                        sizes="(max-width: 768px) 100vw, 320px"
                        className="h-full w-full object-contain p-4"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <div className="rounded-full border border-dashed border-border px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-mute">
                          no preview
                        </div>
                        <p className="text-xs leading-6 text-text-mute">这条记录当前没有关联封面图。</p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 rounded-[22px] border border-border bg-panel-2 px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-mute">说明</div>
                    <p className="mt-2 text-sm leading-6 text-text-mute">
                      编辑购买记录会同步影响该装备的生命周期时间线与状态统计。
                    </p>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-mute">保存后会更新该条购买记录，并同步刷新购买台账。</div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                <Button type="button" variant="secondary" onClick={closeEdit} className="w-full sm:min-w-[6.5rem] sm:w-auto">
                  取消
                </Button>
                <Button type="button" onClick={() => void saveEdit()} disabled={editingSaving} className="w-full sm:min-w-[8.5rem] sm:w-auto">
                  {editingSaving ? "保存中..." : "保存修改"}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

    </div>
  );
}
