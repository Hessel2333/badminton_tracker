import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";
import { createRequestMetrics } from "@/lib/server/perf";
import { revalidateReferenceData } from "@/lib/server/revalidate-app-data";
import { getCachedCategories } from "@/lib/server/reference-data";

const categorySchema = z.object({
  name: z.string().min(1).max(40),
  sortOrder: z.number().int().min(0).default(99)
});

export async function GET() {
  const metrics = createRequestMetrics("api.settings.categories");
  const auth = await metrics.track("auth", () => requireSession());
  if ("error" in auth) return auth.error;

  const items = await metrics.track("cache", () => getCachedCategories());
  metrics.log();
  return NextResponse.json(
    { items },
    {
      headers: metrics.headers()
    }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.category.create({
    data: {
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
      isSystem: false
    }
  });

  revalidateReferenceData();

  return NextResponse.json(item, { status: 201 });
}
