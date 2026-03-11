import { z } from "zod";

export const rangeSchema = z.object({
  range: z.union([z.string().regex(/^\d{4}$/), z.literal("all")]).default("all")
});

export const frequencySchema = z.object({
  granularity: z.enum(["week", "month"]).default("month")
});
