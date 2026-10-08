import { ArchiveWorkspace } from "@/components/forms/ArchiveWorkspace";
import { getArchiveItems } from "@/lib/server/archive-items";
import { getCurrentUserId } from "@/lib/server/auth-guard";
import { getCurrentUserPegboardLayouts } from "@/lib/server/pegboard-layout";

export default async function GearBoardPage() {
  const userId = await getCurrentUserId();
  const [items, initialPegboardLayouts] = await Promise.all([
    getArchiveItems(userId),
    getCurrentUserPegboardLayouts()
  ]);

  return <ArchiveWorkspace initialItems={items} view="display" initialPegboardLayouts={initialPegboardLayouts} />;
}
