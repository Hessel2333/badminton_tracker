import { NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth-guard";
import { getCachedBrands } from "@/lib/server/reference-data";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const items = await getCachedBrands();
  return NextResponse.json({ items });
}
