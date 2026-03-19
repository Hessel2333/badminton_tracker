import { NextResponse } from "next/server";

import { requireSession } from "@/lib/server/auth-guard";
import { createRequestMetrics } from "@/lib/server/perf";
import { getCachedBrands } from "@/lib/server/reference-data";

export async function GET() {
  const metrics = createRequestMetrics("api.settings.brands");
  const auth = await metrics.track("auth", () => requireSession());
  if ("error" in auth) return auth.error;

  const items = await metrics.track("cache", () => getCachedBrands());
  metrics.log();
  return NextResponse.json(
    { items },
    {
      headers: metrics.headers()
    }
  );
}
