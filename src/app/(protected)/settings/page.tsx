import { SettingsManager } from "@/components/forms/SettingsManager";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SectionTitle title="设置" subtitle="维护品类、品牌归一化与备份导出。" />
      <SettingsManager />
    </div>
  );
}
