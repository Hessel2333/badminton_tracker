import { gearCreateSchema } from "@/lib/validators/gear";
import { purchaseSchema } from "@/lib/validators/purchase";
import { wishlistConvertSchema } from "@/lib/validators/wishlist";

describe("validators", () => {
  it("accepts valid purchase payload", () => {
    const result = purchaseSchema.safeParse({
      itemNameSnapshot: "YONEX AS-05",
      unitPriceCny: 98,
      quantity: 2,
      totalPriceCny: null,
      purchaseDate: new Date().toISOString(),
      brandName: "YONEX",
      categoryId: null,
      channel: "JD",
      isSecondHand: false,
      notes: "批量购买"
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid purchase payload", () => {
    const result = purchaseSchema.safeParse({
      itemNameSnapshot: "",
      unitPriceCny: -10,
      quantity: 0,
      purchaseDate: "invalid"
    });

    expect(result.success).toBe(false);
  });

  it("accepts gear payload with rating and external review", () => {
    const result = gearCreateSchema.safeParse({
      name: "ASTROX 100ZZ",
      brandName: "YONEX",
      modelCode: "AX100ZZ",
      rating: {
        power: 9,
        control: 8,
        durability: 8,
        comfort: 7,
        value: 6
      },
      externalReviews: [
        {
          sourceName: "中羽",
          sourceUrl: "https://example.com",
          scoreText: "4.8/5",
          summaryText: "杀球强，门槛高"
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("validates wishlist convert payload", () => {
    const result = wishlistConvertSchema.safeParse({
      purchaseDate: new Date().toISOString(),
      quantity: 1,
      unitPriceCny: 599,
      totalPriceCny: null,
      channel: "Taobao",
      isSecondHand: false
    });

    expect(result.success).toBe(true);
  });
});
