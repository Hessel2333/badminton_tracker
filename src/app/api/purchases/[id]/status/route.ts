import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";

const statusSchema = z.object({
  itemStatus: z.enum(["IN_USE", "USED_UP", "WORN_OUT", "STORED"])
});

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: NextRequest, context: Context) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await context.params;
  const body = await request.json();
  const parsed = statusSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await prisma.purchaseRecord.update({
    where: { id },
    data: {
      itemStatus: parsed.data.itemStatus
    }
  });

  return NextResponse.json(updated);
}
