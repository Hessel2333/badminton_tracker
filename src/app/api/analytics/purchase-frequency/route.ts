import { NextRequest, NextResponse } from "next/server";

import { getPurchaseFrequency } from "@/lib/analytics/queries";
import { requireSession } from "@/lib/server/auth-guard";
import { frequencySchema, rangeSchema } from "@/lib/validators/analytics";

export async function GET(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const parsed = frequencySchema.safeParse({
    granularity: request.nextUrl.searchParams.get("granularity") ?? "month"
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rangeParsed = rangeSchema.safeParse({
    range: request.nextUrl.searchParams.get("range") ?? "12m"
  });

  if (!rangeParsed.success) {
    return NextResponse.json({ error: rangeParsed.error.flatten() }, { status: 400 });
  }

  const data = await getPurchaseFrequency(parsed.data.granularity, rangeParsed.data.range);
  return NextResponse.json({
    granularity: parsed.data.granularity,
    range: rangeParsed.data.range,
    items: data
  });
}
