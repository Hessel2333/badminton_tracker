import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth-guard";
import { getCachedAnalyticsFullData } from "@/lib/server/analytics-data";
import { rangeSchema } from "@/lib/validators/analytics";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const parsed = rangeSchema.safeParse({
    range: request.nextUrl.searchParams.get("range") ?? "all"
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const range = parsed.data.range;

  return NextResponse.json(await getCachedAnalyticsFullData(range));
}
