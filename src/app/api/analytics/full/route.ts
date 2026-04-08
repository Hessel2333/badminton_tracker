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

  // 该接口是“用户私有分析数据”，使用浏览器侧 private cache 抵抗网络抖动：
  // - max-age: 1 分钟内同 range 命中本地缓存
  // - stale-while-revalidate: 允许短时间内使用旧数据，后台刷新
  const headers = metrics.headers({
    "Cache-Control": "private, max-age=60, stale-while-revalidate=300"
  });

  return NextResponse.json(payload, {
    headers
  });
}
