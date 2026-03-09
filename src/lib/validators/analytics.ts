import { z } from "zod";

export const rangeSchema = z.object({
  range: z.string().regex(/^\d+m$/).default("12m")
});

export const frequencySchema = z.object({
  granularity: z.enum(["week", "month"]).default("month")
});
