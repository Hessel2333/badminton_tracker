import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_TIMEOUT_MS = 8000;

function readKeepaliveToken(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-keepalive-token")?.trim() ?? "";
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

async function runReadOnlyProbe(timeoutMs: number) {
  let timer: NodeJS.Timeout | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Keepalive probe timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    const queryPromise = prisma.$queryRaw<Array<{ ok: number; ts: Date }>>`SELECT 1 AS ok, NOW() AS ts`;

    const result = await Promise.race([queryPromise, timeoutPromise]);
    return result[0];
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const expectedToken = process.env.KEEPALIVE_TOKEN;
  const providedToken = readKeepaliveToken(request);
  const timeoutMs = Number(process.env.KEEPALIVE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  if (!expectedToken) {
    console.error("[keepalive] missing KEEPALIVE_TOKEN", { requestId });
    return json(500, { ok: false, error: "Keepalive token is not configured" });
  }

  if (!providedToken || providedToken !== expectedToken) {
    console.warn("[keepalive] unauthorized", { requestId });
    return json(401, { ok: false, error: "Unauthorized" });
  }

  console.info("[keepalive] start", { requestId, timeoutMs });

  try {
    const probe = await runReadOnlyProbe(timeoutMs);
    const durationMs = Date.now() - startedAt;

    console.info("[keepalive] success", { requestId, durationMs });

    return json(200, {
      ok: true,
      requestId,
      durationMs,
      checkedAt: probe.ts.toISOString()
    });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "Unknown keepalive error";

    console.error("[keepalive] failure", { requestId, durationMs, message });

    return json(503, {
      ok: false,
      requestId,
      durationMs,
      error: message
    });
  }
}
