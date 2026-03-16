import { PurchaseManager } from "@/components/forms/PurchaseManager";
import { SectionTitle } from "@/components/ui/SectionTitle";

import { ShoppingBag } from "lucide-react";

export default function PurchasesPage() {
  return (
    <div className="space-y-6">
      <SectionTitle icon={ShoppingBag} title="项目装备库" />
      <PurchaseManager mode="entry" />
    </div>
  );
}
