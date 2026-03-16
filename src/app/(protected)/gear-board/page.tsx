import { ArchiveWorkspace } from "@/components/forms/ArchiveWorkspace";
import { getArchiveItems } from "@/lib/server/archive-items";

export default async function GearBoardPage() {
  const items = await getArchiveItems();
  return <ArchiveWorkspace initialItems={items} view="display" />;
}
