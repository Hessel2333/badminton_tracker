export const PURCHASE_CHANNEL_OPTIONS = ["京东", "淘宝", "拼多多", "线下店", "其他"] as const;

export function getPurchaseChannelOptions(currentValue?: string | null) {
  const base = [...PURCHASE_CHANNEL_OPTIONS];

  if (!currentValue || base.includes(currentValue as (typeof PURCHASE_CHANNEL_OPTIONS)[number])) {
    return base;
  }

  return [currentValue, ...base];
}
