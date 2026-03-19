import { WishlistManager } from "@/components/forms/WishlistManager";
import { SectionTitle } from "@/components/ui/SectionTitle";

import { Heart } from "lucide-react";

export default function WishlistPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Heart}
        title="心愿单"
        subtitle="集中查看从装备库加入的待观察项目，等真正入手后再转成购买记录。"
      />
      <WishlistManager />
    </div>
  );
}
