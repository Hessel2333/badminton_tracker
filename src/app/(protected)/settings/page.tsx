import { SettingsManager } from "@/components/forms/SettingsManager";
import { SectionTitle } from "@/components/ui/SectionTitle";

import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Settings}
        title="系统设置"
        subtitle="治理品类字典、品牌别名、装备引擎权重及核心数据灾备。"
      />
      <SettingsManager />
    </div>
  );
}
