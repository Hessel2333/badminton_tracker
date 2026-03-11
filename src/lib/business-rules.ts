export function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeBrandGroupName(name: string): string {
  const normalized = normalizeBrandName(name);
  if (normalized === "rsl" || normalized === "亚狮龙") return "rsl";
  if (normalized === "chao" || normalized === "超牌") return "chao";
  return normalized;
}

export function canonicalBrandDisplayName(name: string): string {
  const normalized = normalizeBrandGroupName(name);
  if (normalized === "rsl") return "RSL";
  if (normalized === "chao") return "超牌";
  return canonicalWhitespace(name);
}

export function canonicalOptionalBrandDisplayName(name?: string | null) {
  if (!name) return "";
  return canonicalBrandDisplayName(name);
}

export function canonicalWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function extractRslNumber(seed: string) {
  const match = canonicalWhitespace(seed).match(/(?:no\.?\s*)?(\d{1,2})\s*号?/i);
  return match?.[1] ?? null;
}

export function canonicalProductName(input: {
  name: string;
  brandName?: string | null;
  modelCode?: string | null;
  categoryName?: string | null;
}) {
  const name = canonicalWhitespace(input.name);
  const modelCode = canonicalWhitespace(input.modelCode ?? "");
  const brandGroup = normalizeBrandGroupName(input.brandName ?? "");
  const categoryName = canonicalWhitespace(input.categoryName ?? "");
  const shuttleLike = categoryName.includes("羽毛球") || /羽毛球|亚狮龙|rsl|超牌|威肯|翎美/i.test(`${name} ${modelCode} ${input.brandName ?? ""}`);
  const rslNumber = extractRslNumber(`${modelCode} ${name}`);

  if (shuttleLike && (brandGroup === "rsl" || /^亚狮龙\s*\d+号$/i.test(name))) {
    if (rslNumber) return `亚狮龙 ${rslNumber}号`;
    const namedSeriesSeed = `${name} ${modelCode}`.toLowerCase();
    if (/classic|经典/.test(namedSeriesSeed)) return "亚狮龙 Classic";
    if (/supreme|至尊/.test(namedSeriesSeed)) return "亚狮龙 Supreme";
    if (/ultimate|终极/.test(namedSeriesSeed)) return "亚狮龙 Ultimate";
  }

  return name;
}

export function canonicalProductKey(input: {
  name: string;
  brandName?: string | null;
  modelCode?: string | null;
  categoryName?: string | null;
}) {
  const canonicalName = canonicalProductName(input);
  const brandGroup = normalizeBrandGroupName(input.brandName ?? "");
  const modelCode = canonicalWhitespace(input.modelCode ?? "");
  const categoryName = canonicalWhitespace(input.categoryName ?? "");
  const seed = modelCode || canonicalName;

  return [
    categoryName.includes("羽毛球") ? "shuttle" : normalizeBrandName(categoryName),
    brandGroup,
    normalizeBrandName(seed)
  ].join("|");
}

export function calcTotalPrice(unitPrice: number, quantity: number, override?: number | null): number {
  if (typeof override === "number" && Number.isFinite(override) && override >= 0) {
    return roundCurrency(override);
  }
  return roundCurrency(unitPrice * quantity);
}

export function computeOverallRating(input: {
  power: number;
  control: number;
  durability: number;
  comfort: number;
  value: number;
  overall?: number | null;
}, weights?: Partial<Record<"power" | "control" | "durability" | "comfort" | "value", number>>): number {
  if (typeof input.overall === "number" && Number.isFinite(input.overall)) {
    return clampScore(input.overall);
  }

  const mergedWeights = {
    power: weights?.power ?? 1,
    control: weights?.control ?? 1,
    durability: weights?.durability ?? 1,
    comfort: weights?.comfort ?? 1,
    value: weights?.value ?? 1
  };

  const weightedSum =
    input.power * mergedWeights.power +
    input.control * mergedWeights.control +
    input.durability * mergedWeights.durability +
    input.comfort * mergedWeights.comfort +
    input.value * mergedWeights.value;
  const totalWeight =
    mergedWeights.power +
    mergedWeights.control +
    mergedWeights.durability +
    mergedWeights.comfort +
    mergedWeights.value;
  const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return clampScore(avg);
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clampScore(value: number): number {
  return Math.max(0, Math.min(10, Math.round(value * 100) / 100));
}
