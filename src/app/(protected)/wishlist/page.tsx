import { WishlistManager } from "@/components/forms/WishlistManager";
import { SectionTitle } from "@/components/ui/SectionTitle";

import { Heart } from "lucide-react";

export default function WishlistPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        icon={Heart}
        title="心愿单"
        subtitle="标记尚未入手的梦想装备，静待良机，一键转为羽迹，记录成长轨迹。"
      />
      <WishlistManager />
    </div>
  );
}
