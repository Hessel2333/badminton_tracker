import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth-guard";
import { getCachedAnalyticsFullData } from "@/lib/server/analytics-data";
import { createRequestMetrics } from "@/lib/server/perf";
import { rangeSchema } from "@/lib/validators/analytics";

export async function GET(request: NextRequest) {
  const metrics = createRequestMetrics("api.analytics.full");
  const auth = await metrics.track("auth", () => requireSession());
  if ("error" in auth) return auth.error;

  const parsed = rangeSchema.safeParse({
    range: request.nextUrl.searchParams.get("range") ?? "all"
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const range = parsed.data.range;
  const payload = await metrics.track("data", () => getCachedAnalyticsFullData(range));
  metrics.log({ range });

  return NextResponse.json(payload, {
    headers: metrics.headers()
  });
}
