export type GearWallItem = {
  id: string;
  name: string;
  coverImageUrl?: string | null;
  modelCode?: string | null;
  createdAt?: string;
  latestPurchaseDate?: string | null;
  referenceUnitPriceCny?: number | null;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  ratings?: Array<{ overall: number | string }>;
  totalQuantity: number;
  activeQuantity: number;
  usedUpQuantity: number;
  wornOutQuantity: number;
};
