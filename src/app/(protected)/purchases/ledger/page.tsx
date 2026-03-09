import { PurchaseManager } from "@/components/forms/PurchaseManager";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function PurchasesLedgerPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="购买台账"
        subtitle="集中管理历史记录、状态流转与修改。"
      />
      <PurchaseManager mode="ledger" />
    </div>
  );
}
