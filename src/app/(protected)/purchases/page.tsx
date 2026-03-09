import { PurchaseManager } from "@/components/forms/PurchaseManager";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function PurchasesPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="项目装备库选购"
        subtitle="先选装备，再在弹窗里录入价格、数量与渠道。"
      />
      <PurchaseManager mode="entry" />
    </div>
  );
}
