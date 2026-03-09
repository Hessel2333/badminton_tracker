import { WishlistManager } from "@/components/forms/WishlistManager";
import { SectionTitle } from "@/components/ui/SectionTitle";

export default function WishlistPage() {
  return (
    <div className="space-y-6">
      <SectionTitle
        title="心愿单"
        subtitle="管理目标价、状态流转，并支持一键转购买记录。"
      />
      <WishlistManager />
    </div>
  );
}
