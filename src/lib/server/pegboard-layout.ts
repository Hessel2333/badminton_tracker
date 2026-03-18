import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import type { PegboardLayoutStore } from "@/lib/pegboard-layout";
import { prisma } from "@/lib/prisma";

export async function getCurrentUserPegboardLayouts(): Promise<PegboardLayoutStore> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return {};

  const preference = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
    select: { pegboardLayouts: true }
  });

  const layouts = preference?.pegboardLayouts;
  if (!layouts || typeof layouts !== "object" || Array.isArray(layouts)) {
    return {};
  }

  return layouts as PegboardLayoutStore;
}
