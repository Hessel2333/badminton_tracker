import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function readKeepaliveToken(request: NextRequest) {
  const bearer = request.headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    return bearer.slice("Bearer ".length).trim();
  }

  return request.headers.get("x-keepalive-token")?.trim() ?? "";
}

export async function GET(request: NextRequest) {
  const expectedToken = process.env.KEEPALIVE_TOKEN;

  if (!expectedToken) {
    return NextResponse.json(
      { ok: false, error: "Keepalive token is not configured" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (readKeepaliveToken(request) !== expectedToken) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      runtime: "edge",
      checkedAt: new Date().toISOString()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
