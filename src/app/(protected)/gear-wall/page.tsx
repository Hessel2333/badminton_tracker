import { ArchiveWorkspace } from "@/components/forms/ArchiveWorkspace";
import { getArchiveItems } from "@/lib/server/archive-items";

export default async function GearWallPage() {
  const items = await getArchiveItems();
  return <ArchiveWorkspace initialItems={items} view="status" />;
}
