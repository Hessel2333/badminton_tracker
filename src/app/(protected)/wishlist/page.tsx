import { WishlistManager } from "@/components/forms/WishlistManager";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { getWishlistPageData } from "@/lib/server/page-data";

import { Heart } from "lucide-react";

export default async function WishlistPage() {
  const pageData = await getWishlistPageData();

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Heart}
        title="心愿单"
      />
      <WishlistManager {...pageData} />
    </div>
  );
}
