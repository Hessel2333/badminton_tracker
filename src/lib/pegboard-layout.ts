export type PegboardLayoutMode = "active" | "history";

export type PegboardLayoutSlot = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  z: number;
};

export type PegboardLayoutSnapshot = {
  v: number;
  height: number;
  slots: Record<string, PegboardLayoutSlot>;
};

export type PegboardLayoutStore = Partial<Record<PegboardLayoutMode, PegboardLayoutSnapshot>>;

export const PEGBOARD_LAYOUT_VERSION = 12;
