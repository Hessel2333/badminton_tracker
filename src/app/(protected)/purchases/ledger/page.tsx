import { PurchaseManager } from "@/components/forms/PurchaseManager";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPurchasePageData } from "@/lib/server/page-data";

export default async function PurchasesLedgerPage() {
  const pageData = await getPurchasePageData();

  return (
    <div className="space-y-6">
      <SectionTitle
        title="购买台账"
      />
      <PurchaseManager mode="ledger" {...pageData} />
    </div>
  );
}
