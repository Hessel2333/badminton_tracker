export function normalizeBrandName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
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
