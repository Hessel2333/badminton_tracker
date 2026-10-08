import { NextResponse } from "next/server";

import { getOverview } from "@/lib/analytics/queries";
import { requireSession } from "@/lib/server/auth-guard";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const data = await getOverview(auth.session.user.id);
  return NextResponse.json(data);
}
