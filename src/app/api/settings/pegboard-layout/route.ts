import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import type { PegboardLayoutStore } from "@/lib/pegboard-layout";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/auth-guard";

const layoutSlotSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  scale: z.number().finite(),
  rotate: z.number().finite(),
  z: z.number().int().finite()
});

const layoutSnapshotSchema = z.object({
  v: z.number().int().min(1),
  height: z.number().int().min(0),
  slots: z.record(z.string(), layoutSlotSchema)
});

const savePegboardLayoutSchema = z.object({
  mode: z.enum(["active", "history"]),
  layout: layoutSnapshotSchema.nullable()
});

export async function PUT(request: NextRequest) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  const userId = auth.session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = savePegboardLayoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.userPreference.findUnique({
    where: { userId },
    select: { id: true, pegboardLayouts: true }
  });

  const layouts =
    existing?.pegboardLayouts && typeof existing.pegboardLayouts === "object" && !Array.isArray(existing.pegboardLayouts)
      ? ({ ...(existing.pegboardLayouts as PegboardLayoutStore) } satisfies PegboardLayoutStore)
      : ({} satisfies PegboardLayoutStore);

  if (parsed.data.layout) {
    layouts[parsed.data.mode] = parsed.data.layout;
  } else {
    delete layouts[parsed.data.mode];
  }

  if (!existing) {
    await prisma.userPreference.create({
      data: {
        userId,
        pegboardLayouts: layouts
      }
    });
  } else {
    await prisma.userPreference.update({
      where: { id: existing.id },
      data: {
        pegboardLayouts: layouts
      }
    });
  }

  return NextResponse.json({ ok: true, layouts });
}
