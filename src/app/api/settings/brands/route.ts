import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const items = await prisma.brand.findMany({
    orderBy: { name: "asc" }
  });
  return NextResponse.json({ items });
}
