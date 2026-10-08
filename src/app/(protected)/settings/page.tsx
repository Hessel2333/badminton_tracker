import { SettingsManager } from "@/components/forms/SettingsManager";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getSettingsPageData } from "@/lib/server/page-data";

import { Settings } from "lucide-react";

export default async function SettingsPage() {
  const pageData = await getSettingsPageData();

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Settings}
        title="系统设置"
      />
      <SettingsManager {...pageData} />
    </div>
  );
}
