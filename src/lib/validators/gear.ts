import { z } from "zod";

const imageUrlSchema = z
  .string()
  .max(2000)
  .refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), {
    message: "图片地址需为 http(s) URL 或站内 / 路径"
  });

export const gearCreateSchema = z.object({
  name: z.string().min(1).max(120),
  brandName: z.string().max(60).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  modelCode: z.string().max(80).optional().nullable(),
  specJson: z.record(z.any()).optional().nullable(),
  coverImageUrl: imageUrlSchema.optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  rating: z
    .object({
      power: z.number().min(0).max(10),
      control: z.number().min(0).max(10),
      durability: z.number().min(0).max(10),
      comfort: z.number().min(0).max(10),
      value: z.number().min(0).max(10),
      overall: z.number().min(0).max(10).optional().nullable(),
      reviewText: z.string().max(2000).optional().nullable()
    })
    .optional(),
  externalReviews: z
    .array(
      z.object({
        sourceName: z.string().min(1).max(80),
        sourceUrl: z.string().url(),
        scoreText: z.string().max(40).optional().nullable(),
        summaryText: z.string().max(500).optional().nullable()
      })
    )
    .optional()
});

export const gearUpdateSchema = gearCreateSchema;

export type GearCreateInput = z.infer<typeof gearCreateSchema>;
