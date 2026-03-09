"use client";

import useSWR from "swr";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

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

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SettingsManager() {
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(99);
  const [addingCategory, setAddingCategory] = useState(false);
  const [savingDimensions, setSavingDimensions] = useState(false);
  const [dimEdits, setDimEdits] = useState<RatingDimension[] | null>(null);

  const { data: categoryData, mutate: mutateCategories } =
    useSWR<{ items: Category[] }>("/api/settings/categories", fetcher);
  const { data: brandData } =
    useSWR<{ items: Brand[] }>("/api/settings/brands", fetcher);
  const { data: dimensionData, mutate: mutateDimensions } =
    useSWR<{ items: RatingDimension[] }>("/api/settings/rating-dimensions", fetcher);

  const categories = categoryData?.items ?? [];
  const brands = brandData?.items ?? [];
  // 若用户正在编辑评分维度，使用本地草稿；否则使用 SWR 缓存
  const dimensions = dimEdits ?? dimensionData?.items ?? [];

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

  function exportBackup() {
    window.open("/api/settings/backup", "_blank", "noopener,noreferrer");
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
      setDimEdits(null); // 清除草稿，回到 SWR 缓存
      await mutateDimensions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败，请重试");
    } finally {
      setSavingDimensions(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card animate={false}>
        <h2 className="font-display text-xl text-neon">品类管理</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_auto]">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="新增品类名称" />
          <Input
            type="number"
            min={0}
            value={sortOrder}
            onChange={(event) => setSortOrder(Number(event.target.value))}
            placeholder="排序"
          />
          <Button type="button" onClick={addCategory} disabled={addingCategory || !name}>
            {addingCategory ? "新增中..." : "新增品类"}
          </Button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="pb-2">名称</th>
                <th className="pb-2">系统预置</th>
                <th className="pb-2">排序</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-2">{item.name}</td>
                  <td className="py-2 text-mute">{item.isSystem ? "是" : "否"}</td>
                  <td className="py-2">{item.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card animate={false}>
        <h2 className="font-display text-xl text-neon">品牌别名归一化</h2>
        <p className="mt-1 text-sm text-mute">
          统计时按 normalizedName 聚合，避免同品牌不同写法导致统计分裂。
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="pb-2">显示名称</th>
                <th className="pb-2">归一化键</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id} className="border-t border-border">
                  <td className="py-2">{brand.name}</td>
                  <td className="py-2 text-mute">{brand.normalizedName}</td>
                </tr>
              ))}
              {!brands.length ? (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-mute">
                    暂无品牌数据
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card animate={false}>
        <h2 className="font-display text-xl text-neon">评分维度配置</h2>
        <p className="mt-1 text-sm text-mute">用于装备总评自动计算（权重默认为等权）。</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="pb-2">键</th>
                <th className="pb-2">名称</th>
                <th className="pb-2">权重</th>
                <th className="pb-2">启用</th>
              </tr>
            </thead>
            <tbody>
              {dimensions.map((item, index) => (
                <tr key={item.key} className="border-t border-border">
                  <td className="py-2 text-mute">{item.key}</td>
                  <td className="py-2">
                    <Input
                      value={item.label}
                      onChange={(event) =>
                        setDimEdits(
                          dimensions.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, label: event.target.value } : row
                          )
                        )
                      }
                    />
                  </td>
                  <td className="py-2">
                    <Input
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
                  </td>
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={item.isActive}
                      onChange={(event) =>
                        setDimEdits(
                          dimensions.map((row, rowIndex) =>
                            rowIndex === index ? { ...row, isActive: event.target.checked } : row
                          )
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
              {!dimensions.length ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-mute">
                    暂无维度配置
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="mt-3">
          <Button type="button" onClick={saveDimensions} disabled={savingDimensions}>
            {savingDimensions ? "保存中..." : "保存维度配置"}
          </Button>
        </div>
      </Card>

      <Card animate={false}>
        <h2 className="font-display text-xl text-neon">数据备份</h2>
        <p className="mt-1 text-sm text-mute">导出当前核心表 JSON 快照，可用于离线备份。</p>
        <div className="mt-4">
          <Button type="button" onClick={exportBackup}>
            导出备份
          </Button>
        </div>
      </Card>
    </div>
  );
}
