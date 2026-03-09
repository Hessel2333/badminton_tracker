import { WishlistStatus } from "@prisma/client";
import { z } from "zod";

export const wishlistSchema = z.object({
  name: z.string().min(1).max(120),
  brandName: z.string().max(60).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  targetPriceCny: z.number().nonnegative().optional().nullable(),
  currentSeenPriceCny: z.number().nonnegative().optional().nullable(),
  priority: z.number().int().min(1).max(5).default(3),
  status: z.nativeEnum(WishlistStatus).default(WishlistStatus.WANT),
  sourceUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  notes: z.string().max(1000).optional().nullable()
});

export const wishlistConvertSchema = z.object({
  purchaseDate: z.string().datetime(),
  quantity: z.number().int().positive().default(1),
  unitPriceCny: z.number().nonnegative(),
  totalPriceCny: z.number().nonnegative().optional().nullable(),
  channel: z.string().max(100).optional().nullable(),
  isSecondHand: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().nullable()
});
