import { PurchaseManager } from "@/components/forms/PurchaseManager";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getPurchasePageData } from "@/lib/server/page-data";

import { ShoppingBag } from "lucide-react";

export default async function PurchasesPage() {
  const { fallbackPurchases, fallbackCategories, fallbackCatalogItems, fallbackWishlist } = await getPurchasePageData();

  return (
    <div className="space-y-6">
      <SectionTitle icon={ShoppingBag} title="项目装备库" />
      <PurchaseManager
        mode="entry"
        fallbackPurchases={fallbackPurchases}
        fallbackCategories={fallbackCategories}
        fallbackCatalogItems={fallbackCatalogItems}
        fallbackWishlist={fallbackWishlist}
      />
    </div>
  );
}
