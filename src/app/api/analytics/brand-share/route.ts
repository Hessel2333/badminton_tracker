import { NextRequest, NextResponse } from "next/server";

import { getBrandShare } from "@/lib/analytics/queries";
import { requireSession } from "@/lib/server/auth-guard";
import { rangeSchema } from "@/lib/validators/analytics";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const parsed = rangeSchema.safeParse({
    range: request.nextUrl.searchParams.get("range") ?? "12m"
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = await getBrandShare(parsed.data.range);
  return NextResponse.json({ range: parsed.data.range, items: data });
}
