import { getOverview } from "@/lib/analytics/queries";
import { currency, dateText } from "@/lib/utils";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";

import { Layout } from "lucide-react";

export const revalidate = 60;


export default async function DashboardPage() {
  const overview = await getOverview();

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Layout}
        title="总览"
        subtitle="你的羽毛球投入实时雷达，数据驱动，精准反馈。"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="本月投入" value={currency(overview.currentMonthSpend)} transition={{ delay: 0.1 }} />
        <StatCard label="累计投入" value={currency(overview.totalSpend)} transition={{ delay: 0.16 }} />
        <StatCard label="心愿单目标金额" value={currency(overview.wishlistTargetAmount)} transition={{ delay: 0.22 }} />
        <StatCard label="最近记录数" value={String(overview.recentPurchases.length)} transition={{ delay: 0.28 }} />
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-neon">最近购入</h2>
          <span className="text-xs text-mute">最近 5 条</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead className="text-mute">
              <tr>
                <th className="pb-2">日期</th>
                <th className="pb-2">装备</th>
                <th className="pb-2">品牌</th>
                <th className="pb-2">品类</th>
                <th className="pb-2 text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentPurchases.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-2 text-mute">{dateText(item.date)}</td>
                  <td className="py-2">{item.itemName}</td>
                  <td className="py-2">{item.brand}</td>
                  <td className="py-2">{item.category}</td>
                  <td className="py-2 text-right text-neon">{currency(item.totalPrice)}</td>
                </tr>
              ))}
              {!overview.recentPurchases.length ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-mute">
                    暂无购买记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
