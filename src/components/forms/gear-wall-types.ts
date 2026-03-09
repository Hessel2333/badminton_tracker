export type GearWallItem = {
  id: string;
  name: string;
  coverImageUrl?: string | null;
  modelCode?: string | null;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  ratings?: Array<{ overall: number | string }>;
  totalQuantity: number;
  activeQuantity: number;
  usedUpQuantity: number;
  wornOutQuantity: number;
};

