import { NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth-guard";
import { getArchiveItems } from "@/lib/server/archive-items";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const items = await getArchiveItems(auth.session.user.id);
  return NextResponse.json({ items });
}
