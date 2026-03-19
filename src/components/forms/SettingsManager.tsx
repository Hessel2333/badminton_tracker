"use client";

import useSWR from "swr";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Select } from "@/components/ui/Select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSessionStorageState } from "@/hooks/useSessionStorageState";

type Category = {
  id: string;
  name: string;
  isSystem: boolean;
  sortOrder: number;
};

type Brand = {
  id: string;
  name: string;
  normalizedName: string;
};

type RatingDimension = {
  key: string;
  label: string;
  weight: number | string;
  sortOrder: number;
  isActive: boolean;
};

type ProjectCatalogItem = {
  entryKey: string;
  name: string;
  brandName: string;
  modelCode?: string;
  categoryName: string;
  suggestedUnitPriceCny?: number;
  popularity: number;
  imageUrl?: string;
  tags?: string[];
};

type ProjectCatalogForm = {
  entryKey: string;
  name: string;
  brandName: string;
  modelCode: string;
  categoryName: string;
  suggestedUnitPriceCny: string;
  popularity: string;
  imageUrl: string;
  tagsText: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ControlPanel } from "@/components/ui/ControlPanel";
import { Database, Package, ShieldCheck, Tag, Sparkles } from "lucide-react";

type ActiveTab = "catalog" | "taxonomy" | "advanced";

function isActiveTab(value: unknown): value is ActiveTab {
  return value === "catalog" || value === "taxonomy" || value === "advanced";
}

const TAB_OPTIONS = [
  { id: "catalog", label: "项目库", icon: <Package size={14} /> },
  { id: "taxonomy", label: "分类与别名", icon: <Tag size={14} /> },
  { id: "advanced", label: "高级与备份", icon: <Database size={14} /> },
];

export function SettingsManager({
  fallbackCategories,
  fallbackBrands,
  fallbackDimensions,
  fallbackProjectCatalog
}: {
  fallbackCategories?: Category[];
  fallbackBrands?: Brand[];
  fallbackDimensions?: RatingDimension[];
  fallbackProjectCatalog?: ProjectCatalogItem[];
} = {}) {
  const [activeTab, setActiveTab] = useSessionStorageState<ActiveTab>(
    "settings-active-tab",
    "catalog",
    isActiveTab
  );
  const [accentColor, setAccentColor] = useState<string>("default");

  useEffect(() => {
    const stored = window.localStorage.getItem("color") || "default";
    const color = stored === "cyan" ? "victor-blue" : stored;
    if (stored === "cyan") {
      window.localStorage.setItem("color", color);
    }

    if (color && color !== "default") {
      document.documentElement.setAttribute("data-color", color);
    } else {
      document.documentElement.removeAttribute("data-color");
    }
    setAccentColor(color);
  }, []);

  function handleColorChange(color: string) {
    setAccentColor(color);
    if (color === "default") {
      document.documentElement.removeAttribute("data-color");
      window.localStorage.removeItem("color");
    } else {
      document.documentElement.setAttribute("data-color", color);
      window.localStorage.setItem("color", color);
    }
  }

  const COLORS = [
    { id: "default", name: "经典蓝", code: "#0A84FF" },
    { id: "yonex-green", name: "御三家-绿", code: "#00A84F" },
    { id: "victor-blue", name: "御三家-蓝", code: "#0E2F90" },
    { id: "lining-red", name: "御三家-红", code: "#E42D36" },
    { id: "silver", name: "曜岩银 (Obsidian Silver)", code: "#d4d4d8" },
    { id: "orange", name: "工业橙 (Industrial Orange)", code: "#f97316" },
    { id: "purple", name: "虚空紫 (Hyper Purple)", code: "#8b5cf6" },
  ];

  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(99);
  const [addingCategory, setAddingCategory] = useState(false);
  const [savingDimensions, setSavingDimensions] = useState(false);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [importingBackup, setImportingBackup] = useState(false);
  const [dimEdits, setDimEdits] = useState<RatingDimension[] | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogCategoryName, setCatalogCategoryName] = useState("");
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [editingCatalog, setEditingCatalog] = useState<ProjectCatalogForm | null>(null);
  const debouncedCatalogQuery = useDebouncedValue(catalogQuery, 220);

  const { data: categoryData, mutate: mutateCategories } =
    useSWR<{ items: Category[] }>("/api/settings/categories", fetcher, {
      fallbackData: fallbackCategories ? { items: fallbackCategories } : undefined,
      revalidateIfStale: !fallbackCategories,
      revalidateOnMount: !fallbackCategories
    });
  const { data: brandData, mutate: mutateBrands } =
    useSWR<{ items: Brand[] }>("/api/settings/brands", fetcher, {
      fallbackData: fallbackBrands ? { items: fallbackBrands } : undefined,
      revalidateIfStale: !fallbackBrands,
      revalidateOnMount: !fallbackBrands
    });
  const { data: dimensionData, mutate: mutateDimensions } =
    useSWR<{ items: RatingDimension[] }>("/api/settings/rating-dimensions", fetcher, {
      fallbackData: fallbackDimensions ? { items: fallbackDimensions } : undefined,
      revalidateIfStale: !fallbackDimensions,
      revalidateOnMount: !fallbackDimensions
    });
  const projectCatalogUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedCatalogQuery.trim()) params.set("q", debouncedCatalogQuery.trim());
    if (catalogCategoryName) params.set("categoryName", catalogCategoryName);
    return `/api/settings/project-catalog?${params.toString()}`;
  }, [catalogCategoryName, debouncedCatalogQuery]);
  const { data: projectCatalogData, error: projectCatalogError, mutate: mutateProjectCatalog } =
    useSWR<{ items: ProjectCatalogItem[] }>(projectCatalogUrl, fetcher, {
      fallbackData:
        fallbackProjectCatalog && !debouncedCatalogQuery.trim() && !catalogCategoryName
          ? { items: fallbackProjectCatalog }
          : undefined,
      revalidateIfStale: !(fallbackProjectCatalog && !debouncedCatalogQuery.trim() && !catalogCategoryName),
      revalidateOnMount: !(fallbackProjectCatalog && !debouncedCatalogQuery.trim() && !catalogCategoryName)
    });

  const categories = categoryData?.items ?? [];
  const brands = brandData?.items ?? [];
  const dimensions = dimEdits ?? dimensionData?.items ?? [];
  const projectCatalogItems = projectCatalogData?.items ?? [];

  function openCatalogEditor(item: ProjectCatalogItem) {
    setEditingCatalog({
      entryKey: item.entryKey,
      name: item.name,
      brandName: item.brandName,
      modelCode: item.modelCode ?? "",
      categoryName: item.categoryName,
      suggestedUnitPriceCny:
        typeof item.suggestedUnitPriceCny === "number" ? String(item.suggestedUnitPriceCny) : "",
      popularity: String(item.popularity),
      imageUrl: item.imageUrl ?? "",
      tagsText: (item.tags ?? []).join(", ")
    });
  }

  function closeCatalogEditor() {
    setEditingCatalog(null);
  }

  async function addCategory() {
    if (!name) return;
    setAddingCategory(true);
    try {
      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, sortOrder })
      });
      if (!res.ok) throw new Error("新增品类失败");
      setName("");
      setSortOrder(99);
      await mutateCategories();
    } catch (err) {
      alert(err instanceof Error ? err.message : "新增品类失败，请重试");
    } finally {
      setAddingCategory(false);
    }
  }

  async function exportBackup() {
    setExportingBackup(true);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) throw new Error("导出备份失败");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename=\"?([^"]+)\"?/i);
      const fileName = match?.[1] ?? `badminton-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "导出备份失败，请重试");
    } finally {
      setExportingBackup(false);
    }
  }

  async function importBackup(file: File) {
    setImportingBackup(true);
    try {
      const json = await file.text();
      const payload = JSON.parse(json);
      const res = await fetch("/api/settings/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("导入备份失败");
      await mutateCategories();
      await mutateBrands();
      await mutateDimensions();
      await mutateProjectCatalog();
      alert("备份导入完成");
    } catch (err) {
      alert(err instanceof Error ? err.message : "导入备份失败，请重试");
    } finally {
      setImportingBackup(false);
    }
  }

  async function saveDimensions() {
    setSavingDimensions(true);
    try {
      const res = await fetch("/api/settings/rating-dimensions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: dimensions.map((item) => ({
            ...item,
            weight: Number(item.weight)
          }))
        })
      });
      if (!res.ok) throw new Error("保存维度配置失败");
      setDimEdits(null);
      await mutateDimensions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败，请重试");
    } finally {
      setSavingDimensions(false);
    }
  }

  async function saveProjectCatalog() {
    if (!editingCatalog) return;
    setCatalogSaving(true);
    try {
      const res = await fetch("/api/settings/project-catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryKey: editingCatalog.entryKey,
          name: editingCatalog.name,
          brandName: editingCatalog.brandName,
          modelCode: editingCatalog.modelCode || null,
          categoryName: editingCatalog.categoryName,
          suggestedUnitPriceCny:
            editingCatalog.suggestedUnitPriceCny === "" ? null : Number(editingCatalog.suggestedUnitPriceCny),
          popularity: Number(editingCatalog.popularity || 0),
          imageUrl: editingCatalog.imageUrl || null,
          tags: editingCatalog.tagsText
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        })
      });
      if (!res.ok) throw new Error("保存项目装备库失败");
      await mutateProjectCatalog();
      closeCatalogEditor();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存项目装备库失败，请重试");
    } finally {
      setCatalogSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <ControlPanel>
        <SegmentedControl
          fullWidth
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={(v) => setActiveTab(v as ActiveTab)}
        />
      </ControlPanel>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="space-y-6"
        >
          {activeTab === "catalog" && (
            <div className="space-y-6">
              <Card entryAnimation={false}>
                <h2 className="font-display text-xl text-neon">专属项目装备库</h2>
                <p className="mt-1 text-sm text-mute">维护项目库的参考价、品牌、型号、品类、图片与标签，保存后会立即反映到首屏的新增购买页。</p>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
                  <Input
                    value={catalogQuery}
                    onChange={(event) => setCatalogQuery(event.target.value)}
                    placeholder="搜索装备名称 / 品牌 / 型号 / 标签..."
                  />
                  <Select value={catalogCategoryName} onChange={(event) => setCatalogCategoryName(event.target.value)}>
                    <option value="">全部品类</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="mt-4">
                  <Table className="min-w-[860px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>名称 / 型号</TableHead>
                        <TableHead>品牌</TableHead>
                        <TableHead>归属品类</TableHead>
                        <TableHead className="text-right">参考价</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectCatalogItems.map((item) => (
                        <TableRow key={item.entryKey} className="group">
                          <TableCell>
                            <div className="font-medium text-text">{item.name}</div>
                            {item.modelCode && <div className="text-xs text-mute mt-0.5">{item.modelCode}</div>}
                          </TableCell>
                          <TableCell className="text-text-mute">{item.brandName}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-border/40 text-xs font-medium text-text-mute">
                              {item.categoryName}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-display tabular-nums">
                            {typeof item.suggestedUnitPriceCny === "number" ? `¥${item.suggestedUnitPriceCny}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" type="button" variant="ghost" className="transition-opacity" onClick={() => openCatalogEditor(item)}>
                              编辑
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {projectCatalogError ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-danger">
                            项目装备库加载失败
                          </TableCell>
                        </TableRow>
                      ) : !projectCatalogItems.length ? (
                        <TableRow>
                          <TableCell colSpan={5} className="py-12 text-center text-mute">
                            暂无匹配的装备项目
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {editingCatalog ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
                  <Card className="max-h-[88vh] w-full max-w-4xl overflow-y-auto">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-lg text-neon">编辑项目装备</h3>
                        <p className="mt-1 text-xs text-mute">{editingCatalog.entryKey}</p>
                      </div>
                      <Button type="button" variant="secondary" onClick={closeCatalogEditor} disabled={catalogSaving}>
                        关闭
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      <div className="xl:col-span-2">
                        <label className="mb-1 block text-xs uppercase tracking-widest text-mute">名称</label>
                        <Input value={editingCatalog.name} onChange={(event) => setEditingCatalog((s) => s ? { ...s, name: event.target.value } : s)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品牌</label>
                        <Input value={editingCatalog.brandName} onChange={(event) => setEditingCatalog((s) => s ? { ...s, brandName: event.target.value } : s)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-widest text-mute">型号</label>
                        <Input value={editingCatalog.modelCode} onChange={(event) => setEditingCatalog((s) => s ? { ...s, modelCode: event.target.value } : s)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-widest text-mute">品类</label>
                        <Select value={editingCatalog.categoryName} onChange={(event) => setEditingCatalog((s) => s ? { ...s, categoryName: event.target.value } : s)}>
                          {categories.map((item) => (
                            <option key={item.id} value={item.name}>
                              {item.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-widest text-mute">参考价</label>
                        <Input type="number" min={0} step="0.01" value={editingCatalog.suggestedUnitPriceCny} onChange={(event) => setEditingCatalog((s) => s ? { ...s, suggestedUnitPriceCny: event.target.value } : s)} />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs uppercase tracking-widest text-mute">图片 URL</label>
                        <Input value={editingCatalog.imageUrl} onChange={(event) => setEditingCatalog((s) => s ? { ...s, imageUrl: event.target.value } : s)} placeholder="/gear-images/... 或 https://..." />
                      </div>
                      <div className="xl:col-span-2">
                        <label className="mb-1 block text-xs uppercase tracking-widest text-mute">标签</label>
                        <Textarea value={editingCatalog.tagsText} onChange={(event) => setEditingCatalog((s) => s ? { ...s, tagsText: event.target.value } : s)} rows={2} placeholder="常规推荐, 比赛, 耐打" />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button type="button" onClick={saveProjectCatalog} disabled={catalogSaving}>
                        {catalogSaving ? "配置保存中..." : "保存项目装备更改"}
                      </Button>
                      <Button type="button" variant="secondary" onClick={closeCatalogEditor} disabled={catalogSaving}>
                        取消操作
                      </Button>
                    </div>
                  </Card>
                </div>
              ) : null}
            </div>
          )}

          {activeTab === "taxonomy" && (
            <div className="space-y-6">
              <Card entryAnimation={false}>
                <h2 className="font-display text-xl text-neon">品类管理字典</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_auto]">
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="新大类名称" />
                  <Input
                    type="number"
                    min={0}
                    value={sortOrder}
                    onChange={(event) => setSortOrder(Number(event.target.value))}
                    placeholder="排序权重"
                  />
                  <Button type="button" onClick={addCategory} disabled={addingCategory || !name}>
                    {addingCategory ? "录入中..." : "录入新品类"}
                  </Button>
                </div>

                <div className="mt-5">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>名称空间</TableHead>
                        <TableHead>系统内置</TableHead>
                        <TableHead>渲染排序码</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium text-text">{item.name}</TableCell>
                          <TableCell>
                            {item.isSystem ? <span className="text-accent text-[10px] bg-accent/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">System</span> : <span className="text-mute text-[10px] uppercase font-bold tracking-wider">Custom</span>}
                          </TableCell>
                          <TableCell className="font-display tabular-nums">{item.sortOrder}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card entryAnimation={false}>
                <h2 className="font-display text-xl text-neon">品牌别名散列映射</h2>
                <p className="mt-1 text-sm text-mute">
                  后台数据统计时按 Normalized Name 聚合清洗，避免前端同品牌不同口径（如尤尼克斯 vs YY）导致统计集分裂。
                </p>
                <div className="mt-5">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>前端显示名 (Raw Input)</TableHead>
                        <TableHead>计算主键 (Normalized Key)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {brands.map((brand) => (
                        <TableRow key={brand.id}>
                          <TableCell className="font-medium text-text">{brand.name}</TableCell>
                          <TableCell className="text-mute font-mono text-xs opacity-70">{brand.normalizedName}</TableCell>
                        </TableRow>
                      ))}
                      {!brands.length ? (
                        <TableRow>
                          <TableCell colSpan={2} className="py-8 text-center text-mute">
                            暂无品牌词典数据积淀
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </div>
          )}

          {activeTab === "advanced" && (
            <div className="space-y-6">
              <Card entryAnimation={false}>
                <h2 className="font-display text-xl text-neon">全域质感色彩偏好</h2>
                <p className="mt-1 text-sm text-mute">选择最符合你操作直觉的强调色变体，点击即刻无缝沉浸。</p>
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleColorChange(c.id)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-[16px] border bg-panel px-4 py-3 transition-colors hover:bg-panel-2 text-left",
                        accentColor === c.id ? "border-accent shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" : "border-border/60"
                      )}
                    >
                      <span
                        className="h-5 w-5 shrink-0 rounded-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] border border-black/20"
                        style={{ backgroundColor: c.code }}
                      />
                      <span className={cn("text-sm font-medium truncate flex-1 transition-colors", accentColor === c.id ? "text-text" : "text-text-mute group-hover:text-text")}>
                        {c.name}
                      </span>
                      {accentColor === c.id && (
                        <motion.div layoutId="color-active-ring" className="absolute inset-[-1px] rounded-[16px] border-[1.5px] border-accent pointer-events-none" transition={{ type: "spring", stiffness: 450, damping: 25 }} />
                      )}
                    </button>
                  ))}
                </div>
              </Card>

              <Card entryAnimation={false}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl text-neon">装备加权评分引擎</h2>
                    <p className="mt-1 text-sm text-mute">分配或调整各项主观雷达图维度的乘数权重，以干预最终 Total Score 的评判偏好。</p>
                  </div>
                </div>
                <div className="mt-5">
                  <Table className="min-w-[560px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>特征 Key</TableHead>
                        <TableHead>前端渲染名</TableHead>
                        <TableHead>权重倍率</TableHead>
                        <TableHead className="text-center">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dimensions.map((item, index) => (
                        <TableRow key={item.key}>
                          <TableCell className="text-mute font-mono text-[11px] opacity-60 max-w-32 truncate">{item.key}</TableCell>
                          <TableCell className="px-2">
                            <Input
                              className="h-9 px-3 text-sm bg-panel/50"
                              value={item.label}
                              onChange={(event) =>
                                setDimEdits(
                                  dimensions.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, label: event.target.value } : row
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="px-2">
                            <Input
                              className="h-9 px-3 text-sm max-w-[80px] font-display tabular-nums bg-panel/50 outline-none focus:ring-accent/20"
                              type="number"
                              min={0}
                              step="0.1"
                              value={String(item.weight)}
                              onChange={(event) =>
                                setDimEdits(
                                  dimensions.map((row, rowIndex) =>
                                    rowIndex === index ? { ...row, weight: Number(event.target.value) } : row
                                  )
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <label className="relative inline-flex items-center cursor-pointer scale-90">
                              <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={item.isActive}
                                onChange={(event) =>
                                  setDimEdits(
                                    dimensions.map((row, rowIndex) =>
                                      rowIndex === index ? { ...row, isActive: event.target.checked } : row
                                    )
                                  )
                                }
                              />
                              <div className="peer h-5 w-9 rounded-full bg-border transition-all after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-accent peer-checked:after:translate-x-full peer-focus:ring-2 peer-focus:ring-accent/20" />
                            </label>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-4 flex">
                  <Button type="button" onClick={saveDimensions} disabled={savingDimensions}>
                    {savingDimensions ? "重写引擎字典中..." : "保存雷达权重"}
                  </Button>
                </div>
              </Card>

              <Card entryAnimation={false}>
                <h2 className="font-display text-xl text-neon text-danger">系统核心安全快照</h2>
                <p className="mt-1 text-sm text-mute">将 PostgreSQL 存储的主数据热导出为 JSON，或覆写灾备。</p>
                <div className="mt-5 flex flex-wrap gap-3 p-4 bg-danger/5 border border-danger/20 rounded-2xl">
                  <Button type="button" variant="secondary" className="hover:bg-panel-2 border-border" onClick={exportBackup} disabled={exportingBackup}>
                    {exportingBackup ? "正在封装快照包..." : "下传离线 JSON 镜像"}
                  </Button>
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-danger/40 bg-danger/10 px-5 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger hover:text-white shadow-sm">
                    {importingBackup ? "载入源文件中..." : "危险性灾备覆写"}
                    <input
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          if (confirm("🚨严重警告：此操作不可挽回！旧版数据库将被强制丢弃替换，请问是否继续挂载新镜像？")) {
                            void importBackup(file);
                          }
                        }
                        event.currentTarget.value = "";
                      }}
                      disabled={importingBackup}
                    />
                  </label>
                </div>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
