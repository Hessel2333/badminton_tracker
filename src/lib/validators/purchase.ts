import { z } from "zod";

export const purchaseSchema = z.object({
  gearItemId: z.string().optional().nullable(),
  brandName: z.string().min(1, "品牌不能为空").max(60).optional().nullable(),
  modelCode: z.string().max(80).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  itemNameSnapshot: z.string().min(1, "名称不能为空").max(120),
  unitPriceCny: z.number().nonnegative(),
  quantity: z.number().int().positive().default(1),
  totalPriceCny: z.number().nonnegative().optional().nullable(),
  purchaseDate: z.string().datetime(),
  channel: z.string().max(100).optional().nullable(),
  itemStatus: z.enum(["IN_USE", "USED_UP", "WORN_OUT", "STORED"]).default("IN_USE"),
  isSecondHand: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().nullable(),
  receiptImageUrl: z.string().url().optional().nullable()
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;
