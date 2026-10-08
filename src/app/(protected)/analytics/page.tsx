import { AnalyticsBoard } from "@/components/forms/AnalyticsBoard";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getCurrentUserId } from "@/lib/server/auth-guard";
import { getCachedAnalyticsAvailableYears } from "@/lib/server/analytics-data";

import { BarChart3 } from "lucide-react";

export const revalidate = 60; // 分析数据可用 60s 缓存

export default async function AnalyticsPage() {
  const userId = await getCurrentUserId();
  const availableYears = await getCachedAnalyticsAvailableYears(userId);

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={BarChart3}
        title="分析看板"
      />
      <AnalyticsBoard availableYears={availableYears} />
    </div>
  );
}
