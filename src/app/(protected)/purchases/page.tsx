import { PurchaseManager } from "@/components/forms/PurchaseManager";
import { SectionTitle } from "@/components/ui/SectionTitle";

import { ShoppingBag } from "lucide-react";

export default function PurchasesPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        icon={ShoppingBag}
        title="项目装备库选购"
        subtitle="先由库中海选心仪型号，再录入价格、数量与渠道，构建你的羽痕档案。"
      />
      <PurchaseManager mode="entry" />
    </div>
  );
}
