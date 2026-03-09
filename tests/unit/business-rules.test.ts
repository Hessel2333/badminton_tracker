import {
  calcTotalPrice,
  clampScore,
  computeOverallRating,
  normalizeBrandName,
  roundCurrency
} from "@/lib/business-rules";

describe("business-rules", () => {
  it("normalizes brand names consistently", () => {
    expect(normalizeBrandName("  Yonex   ")).toBe("yonex");
    expect(normalizeBrandName("Li   Ning")).toBe("li ning");
  });

  it("calculates total by unit x quantity when no override", () => {
    expect(calcTotalPrice(129.9, 2)).toBe(259.8);
  });

  it("uses override total when provided", () => {
    expect(calcTotalPrice(129.9, 2, 250)).toBe(250);
  });

  it("computes average overall rating and clamps to 0-10", () => {
    expect(
      computeOverallRating({
        power: 8,
        control: 7,
        durability: 9,
        comfort: 7,
        value: 8
      })
    ).toBe(7.8);

    expect(clampScore(12)).toBe(10);
    expect(clampScore(-1)).toBe(0);
  });

  it("supports weighted rating dimensions", () => {
    const weighted = computeOverallRating(
      {
        power: 9,
        control: 7,
        durability: 6,
        comfort: 6,
        value: 5
      },
      {
        power: 2,
        control: 1,
        durability: 1,
        comfort: 1,
        value: 1
      }
    );
    expect(weighted).toBe(7);
  });

  it("rounds currency safely", () => {
    expect(roundCurrency(1.005)).toBe(1);
    expect(roundCurrency(1.235)).toBe(1.24);
  });
});
