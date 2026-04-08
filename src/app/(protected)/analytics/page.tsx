import { AnalyticsBoard } from "@/components/forms/AnalyticsBoard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getCachedAnalyticsAvailableYears } from "@/lib/server/analytics-data";

import { BarChart3 } from "lucide-react";

export const revalidate = 60; // 分析数据可用 60s 缓存

export default async function AnalyticsPage() {
  const availableYears = await getCachedAnalyticsAvailableYears();

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={BarChart3}
        title="分析看板"
        subtitle="投入趋势、品牌品类占比、频率、转化与评分排行。数据驱动决策，优化你的装备生命周期。"
      />
      <AnalyticsBoard availableYears={availableYears} />
    </div>
  );
}
