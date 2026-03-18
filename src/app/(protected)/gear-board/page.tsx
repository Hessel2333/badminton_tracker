import { ArchiveWorkspace } from "@/components/forms/ArchiveWorkspace";
import { getArchiveItems } from "@/lib/server/archive-items";
import { getCurrentUserPegboardLayouts } from "@/lib/server/pegboard-layout";

export default async function GearBoardPage() {
  const [items, initialPegboardLayouts] = await Promise.all([
    getArchiveItems(),
    getCurrentUserPegboardLayouts()
  ]);

  return <ArchiveWorkspace initialItems={items} view="display" initialPegboardLayouts={initialPegboardLayouts} />;
}
