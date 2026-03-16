"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageDown, RotateCcw, Sparkles, Tag, Database, Package } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { GearWallItem } from "@/components/forms/gear-wall-types";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ControlPanel } from "@/components/ui/ControlPanel";

type BoardInstance = {
  instanceId: string;
  gearId: string;
  name: string;
  categoryName: string;
  brandName: string;
  modelName: string;
  imageUrl: string | null;
  width: number;
  height: number;
  defaultRotate: number;
  active: boolean;
  historyType: "usedUp" | "wornOut" | null;
  indexInGroup: number;
};

type LayoutSlot = {
  x: number;
  y: number;
  scale: number;
  rotate: number;
  z: number;
};

type ImageMetrics = {
  naturalWidth: number;
  naturalHeight: number;
  contentAspect: number;
  occupancyLongest: number;
  majorAxisAngleDeg: number;
};

const STORAGE_KEY = "gear-board-layout-v12";
const LAYOUT_VERSION = 12;
const DESKTOP_BOARD_MIN_HEIGHT = 960;
const WHITE_BG_THRESHOLD = 246;

function boardMinHeight(boardWidth: number) {
  return boardWidth < 640 ? 700 : DESKTOP_BOARD_MIN_HEIGHT;
}

function boardPadding(boardWidth: number) {
  return boardWidth < 640 ? 16 : 28;
}

function boardGap(boardWidth: number) {
  return boardWidth < 640 ? 14 : 24;
}

function shuttleGapX(boardWidth: number) {
  return boardWidth < 640 ? 6 : 8;
}

function shuttleGapY(boardWidth: number) {
  return boardWidth < 640 ? 8 : 12;
}

function sectionGap(boardWidth: number) {
  return boardWidth < 640 ? 24 : 38;
}

function isRacketCategory(categoryName: string) {
  return categoryName.includes("球拍");
}

function isShoesCategory(categoryName: string) {
  return categoryName.includes("球鞋");
}

function isShuttleCategory(categoryName: string) {
  return categoryName.includes("羽毛球");
}

function historicalQuantity(item: GearWallItem, categoryName: string) {
  if (isShuttleCategory(categoryName)) return Math.max(0, item.usedUpQuantity);
  if (isRacketCategory(categoryName) || isShoesCategory(categoryName)) {
    return Math.max(0, item.wornOutQuantity);
  }
  return 0;
}

function inferCategoryNameFromSeed(seed: string) {
  const text = seed.toLowerCase();
  if (/球拍|racket|thruster|hammer|铁锤|tk[\s\-_]?hmr|frames?/i.test(text)) return "球拍";
  if (/球鞋|shoes?|p\d{4}|p9200|p8500|tty|nl|max|贴地飞行/i.test(text)) return "球鞋";
  if (/羽毛球|shuttle|亚狮龙|rsl|[红黄蓝绿紫粉橙银]超|金红超|as[\s\-_]?50|yonex/i.test(text)) return "羽毛球";
  return "未分类";
}

function resolveCategoryName(item: GearWallItem) {
  const raw = item.category?.name?.trim();
  if (raw) return raw;
  const seed = [item.name, item.modelCode ?? "", item.coverImageUrl ?? ""].join(" ");
  return inferCategoryNameFromSeed(seed);
}

function physicalLongestCmByCategory(categoryName: string) {
  if (isRacketCategory(categoryName)) return 66.5;
  if (isShoesCategory(categoryName)) return 28;
  if (isShuttleCategory(categoryName)) return 40;
  return 32;
}

function fallbackAspectByCategory(categoryName: string) {
  if (isRacketCategory(categoryName)) return 0.24;
  if (isShoesCategory(categoryName)) return 2.25;
  if (isShuttleCategory(categoryName)) return 0.18;
  return 1;
}

function pixelPerCm(boardWidth: number) {
  if (boardWidth <= 0) return 5.8;
  if (boardWidth < 640) return clamp(boardWidth / 200, 3.8, 6.2);
  return clamp(boardWidth / 200, 5.8, 9.4);
}

function mobileBoardScale(boardWidth: number) {
  return boardWidth < 640 ? 0.8 : 1;
}

function sizeByCategory(
  categoryName: string,
  boardWidth: number,
  metrics: ImageMetrics | null
) {
  const longestCm = physicalLongestCmByCategory(categoryName);
  const longestPx = longestCm * pixelPerCm(boardWidth || 1120) * mobileBoardScale(boardWidth || 1120);
  const rawAspect = metrics?.contentAspect ?? fallbackAspectByCategory(categoryName);

  let contentWidth = 0;
  let contentHeight = 0;

  if (isRacketCategory(categoryName)) {
    const ratio = clamp(Math.max(rawAspect, 1 / Math.max(rawAspect, 0.001)), 2.4, 8.6);
    contentHeight = longestPx;
    contentWidth = longestPx / ratio;
  } else {
    const aspect = isShuttleCategory(categoryName)
      ? clamp(rawAspect, 0.17, 0.2)
      : isShoesCategory(categoryName)
        ? clamp(rawAspect, 1.6, 3.4)
        : clamp(rawAspect, 0.2, 4.2);

    if (aspect >= 1) {
      contentWidth = longestPx;
      contentHeight = longestPx / aspect;
    } else {
      contentHeight = longestPx;
      contentWidth = longestPx * aspect;
    }
  }

  return {
    width: Math.round(contentWidth),
    height: Math.round(contentHeight)
  };
}

function categoryPriority(categoryName: string) {
  if (isShuttleCategory(categoryName)) return 1;
  if (isShoesCategory(categoryName)) return 2;
  if (isRacketCategory(categoryName)) return 3;
  return 9;
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function normalizeBrandGroupKey(value: string) {
  const normalized = normalizeKey(value);
  if (!normalized) return normalized;
  if (normalized === "rsl" || normalized === "亚狮龙") return "rsl";
  if (normalized === "超牌" || normalized === "chao") return "chao";
  return normalized;
}

function modelSortKey(value: string) {
  const text = normalizeKey(value);
  const match = text.match(/(?:no\.?|no)?(\d{1,2})/i);
  if (match) {
    return { kind: "num" as const, value: Number(match[1]) };
  }
  return { kind: "text" as const, value: text };
}

function compareShuttleInstance(a: BoardInstance, b: BoardInstance) {
  const brandCompare = normalizeBrandGroupKey(a.brandName).localeCompare(
    normalizeBrandGroupKey(b.brandName),
    "zh-Hans-CN"
  );
  if (brandCompare !== 0) return brandCompare;

  const modelA = modelSortKey(a.modelName || a.name);
  const modelB = modelSortKey(b.modelName || b.name);
  if (modelA.kind !== modelB.kind) return modelA.kind === "num" ? -1 : 1;
  if (modelA.value !== modelB.value) {
    return modelA.kind === "num"
      ? Number(modelA.value) - Number(modelB.value)
      : String(modelA.value).localeCompare(String(modelB.value), "zh-Hans-CN");
  }

  const nameCompare = a.name.localeCompare(b.name, "zh-Hans-CN");
  if (nameCompare !== 0) return nameCompare;
  return a.indexInGroup - b.indexInGroup;
}

function sortShuttleByBrandAndModel(instances: BoardInstance[]) {
  const groupMap = new Map<string, BoardInstance[]>();

  for (const instance of instances) {
    const key = normalizeBrandGroupKey(instance.brandName) || "unknown-brand";
    const group = groupMap.get(key) ?? [];
    group.push(instance);
    groupMap.set(key, group);
  }

  return [...groupMap.entries()]
    .sort((a, b) => {
      if (a[1].length !== b[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0], "zh-Hans-CN");
    })
    .flatMap(([, group]) => group.sort(compareShuttleInstance));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function footprintSize(width: number, height: number, rotateDeg: number) {
  const rad = (rotateDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    width: Math.abs(width * cos) + Math.abs(height * sin),
    height: Math.abs(width * sin) + Math.abs(height * cos)
  };
}

function fitScaleToBoard(
  instanceWidth: number,
  instanceHeight: number,
  rotateDeg: number,
  boardWidth: number,
  boardHeight: number
) {
  const padding = boardPadding(boardWidth);
  const baseFootprint = footprintSize(instanceWidth, instanceHeight, rotateDeg);
  const availableWidth = Math.max(120, boardWidth - padding * 2);
  const availableHeight = Math.max(120, boardHeight - padding * 2);
  const mobileScaleCap = boardWidth < 640 ? 1.15 : 2.4;

  return Math.max(
    0.28,
    Math.min(
      mobileScaleCap,
      availableWidth / Math.max(1, baseFootprint.width),
      availableHeight / Math.max(1, baseFootprint.height)
    )
  );
}

function recommendedLayoutScale(
  instanceWidth: number,
  instanceHeight: number,
  rotateDeg: number,
  boardWidth: number,
  boardHeight: number
) {
  return Math.min(1, fitScaleToBoard(instanceWidth, instanceHeight, rotateDeg, boardWidth, boardHeight));
}

function clampSlot(slot: LayoutSlot, instance: BoardInstance, boardWidth: number, boardHeight: number): LayoutSlot {
  const padding = boardPadding(boardWidth);
  const rotate = clamp(slot.rotate, -90, 90);
  const maxScale = fitScaleToBoard(instance.width, instance.height, rotate, boardWidth, boardHeight);
  const minScale = Math.min(0.45, maxScale);
  const scale = clamp(slot.scale, minScale, maxScale);
  const width = instance.width * scale;
  const height = instance.height * scale;
  const footprint = footprintSize(width, height, rotate);
  const protrudeX = Math.max(0, (footprint.width - width) / 2);
  const protrudeY = Math.max(0, (footprint.height - height) / 2);
  const minX = padding + protrudeX;
  const minY = padding + protrudeY;
  const maxX = Math.max(minX, boardWidth - width - padding - protrudeX);
  const maxY = Math.max(minY, boardHeight - height - padding - protrudeY);

  return {
    x: clamp(slot.x, minX, maxX),
    y: clamp(slot.y, minY, maxY),
    scale,
    rotate,
    z: Math.max(1, Math.floor(slot.z))
  };
}

function normalize180(angle: number) {
  const wrapped = ((angle + 90) % 180 + 180) % 180 - 90;
  return wrapped;
}

function autoRotateForRacket(metrics: ImageMetrics | null) {
  if (!metrics) return 0;
  const correction = 90 - metrics.majorAxisAngleDeg;
  return clamp(normalize180(correction), -75, 75);
}

function recommendLayout(instances: BoardInstance[], boardWidth: number) {
  const padding = boardPadding(boardWidth);
  const gap = boardGap(boardWidth);
  const shuttleXGap = shuttleGapX(boardWidth);
  const shuttleYGap = shuttleGapY(boardWidth);
  const zoneGap = sectionGap(boardWidth);
  const baseBoardHeight = boardMinHeight(boardWidth);
  const slots: Record<string, LayoutSlot> = {};
  const sortedAll = [...instances].sort((a, b) => {
    const priority = categoryPriority(a.categoryName) - categoryPriority(b.categoryName);
    if (priority !== 0) return priority;
    const areaA = a.width * a.height;
    const areaB = b.width * b.height;
    if (areaA !== areaB) return areaB - areaA;
    return a.indexInGroup - b.indexInGroup;
  });

  const shuttleInstances = sortShuttleByBrandAndModel(sortedAll.filter((item) => isShuttleCategory(item.categoryName)));
  const shoesInstances = sortedAll.filter((item) => isShoesCategory(item.categoryName));
  const racketInstances = sortedAll.filter((item) => isRacketCategory(item.categoryName));
  const otherInstances = sortedAll.filter(
    (item) => !isShuttleCategory(item.categoryName) && !isShoesCategory(item.categoryName) && !isRacketCategory(item.categoryName)
  );

  let x = padding;
  let y = padding;
  let rowHeight = 0;
  let z = 2;

  for (const instance of shuttleInstances) {
    const scale = recommendedLayoutScale(instance.width, instance.height, instance.defaultRotate, boardWidth, baseBoardHeight);
    const width = instance.width * scale;
    const height = instance.height * scale;
    const footprint = footprintSize(width, height, instance.defaultRotate);
    const protrudeX = Math.max(0, (footprint.width - width) / 2);
    const protrudeY = Math.max(0, (footprint.height - height) / 2);

    if (x + footprint.width > boardWidth - padding) {
      x = padding;
      y += rowHeight + shuttleYGap;
      rowHeight = 0;
    }

    slots[instance.instanceId] = {
      x: x + protrudeX,
      y: y + protrudeY,
      scale,
      rotate: instance.defaultRotate,
      z: z++
    };

    x += footprint.width + shuttleXGap;
    rowHeight = Math.max(rowHeight, footprint.height);
  }

  const shuttleBottom = y + rowHeight;
  const sectionTop = shuttleInstances.length > 0 ? shuttleBottom + zoneGap : padding;
  x = padding;
  y = sectionTop;
  rowHeight = 0;

  for (const instance of racketInstances) {
    const scale = recommendedLayoutScale(instance.width, instance.height, instance.defaultRotate, boardWidth, baseBoardHeight);
    const width = instance.width * scale;
    const height = instance.height * scale;
    const footprint = footprintSize(width, height, instance.defaultRotate);
    const protrudeX = Math.max(0, (footprint.width - width) / 2);
    const protrudeY = Math.max(0, (footprint.height - height) / 2);

    if (x + footprint.width > boardWidth - padding && x > padding) {
      x = padding;
      y += rowHeight + gap;
      rowHeight = 0;
    }

    slots[instance.instanceId] = {
      x: x + protrudeX,
      y: y + protrudeY,
      scale,
      rotate: instance.defaultRotate,
      z: z++
    };

    x += footprint.width + gap;
    rowHeight = Math.max(rowHeight, footprint.height);
  }

  const racketBottom = y + rowHeight;
  const shoesTop = (racketInstances.length > 0 || shuttleInstances.length > 0) ? racketBottom + zoneGap : padding;

  type RowItem = {
    instance: BoardInstance;
    scale: number;
    width: number;
    height: number;
    footprintWidth: number;
    footprintHeight: number;
    protrudeX: number;
    protrudeY: number;
  };

  const placeBottomAlignedRow = (rowItems: RowItem[], rowTop: number) => {
    if (!rowItems.length) return 0;
    const maxFootprintHeight = rowItems.reduce((max, item) => Math.max(max, item.footprintHeight), 0);
    let rowX = padding;

    for (const rowItem of rowItems) {
      const yOffset = maxFootprintHeight - rowItem.footprintHeight;
      slots[rowItem.instance.instanceId] = {
        x: rowX + rowItem.protrudeX,
        y: rowTop + yOffset + rowItem.protrudeY,
        scale: rowItem.scale,
        rotate: rowItem.instance.defaultRotate,
        z: z++
      };
      rowX += rowItem.footprintWidth + gap;
    }

    return maxFootprintHeight;
  };

  let shoesBottom = shoesTop;
  let currentShoesTop = shoesTop;
  let shoesRowItems: RowItem[] = [];
  let shoesRowWidth = 0;

  const flushShoesRow = () => {
    if (!shoesRowItems.length) return;
    const rowHeightPlaced = placeBottomAlignedRow(shoesRowItems, currentShoesTop);
    shoesBottom = Math.max(shoesBottom, currentShoesTop + rowHeightPlaced);
    currentShoesTop += rowHeightPlaced + gap;
    shoesRowItems = [];
    shoesRowWidth = 0;
  };

  for (const instance of shoesInstances) {
    const scale = recommendedLayoutScale(instance.width, instance.height, instance.defaultRotate, boardWidth, baseBoardHeight);
    const width = instance.width * scale;
    const height = instance.height * scale;
    const footprint = footprintSize(width, height, instance.defaultRotate);
    const protrudeX = Math.max(0, (footprint.width - width) / 2);
    const protrudeY = Math.max(0, (footprint.height - height) / 2);
    const nextWidth = shoesRowItems.length === 0 ? footprint.width : shoesRowWidth + gap + footprint.width;

    if (nextWidth > boardWidth - padding * 2 && shoesRowItems.length > 0) {
      flushShoesRow();
    }

    shoesRowItems.push({
      instance,
      scale,
      width,
      height,
      footprintWidth: footprint.width,
      footprintHeight: footprint.height,
      protrudeX,
      protrudeY
    });
    shoesRowWidth = shoesRowItems.length === 1 ? footprint.width : shoesRowWidth + gap + footprint.width;
  }
  flushShoesRow();

  x = padding;
  y = shoesInstances.length > 0 ? shoesBottom + zoneGap : shoesTop;
  rowHeight = 0;

  for (const instance of otherInstances) {
    const scale = recommendedLayoutScale(instance.width, instance.height, instance.defaultRotate, boardWidth, baseBoardHeight);
    const width = instance.width * scale;
    const height = instance.height * scale;
    const footprint = footprintSize(width, height, instance.defaultRotate);
    const protrudeX = Math.max(0, (footprint.width - width) / 2);
    const protrudeY = Math.max(0, (footprint.height - height) / 2);

    if (x + footprint.width > boardWidth - padding && x > padding) {
      x = padding;
      y += rowHeight + gap;
      rowHeight = 0;
    }

    slots[instance.instanceId] = {
      x: x + protrudeX,
      y: y + protrudeY,
      scale,
      rotate: instance.defaultRotate,
      z: z++
    };

    x += footprint.width + gap;
    rowHeight = Math.max(rowHeight, footprint.height);
  }

  const otherBottom = y + rowHeight;
  const height = Math.max(
    boardMinHeight(boardWidth),
    Math.ceil(Math.max(shuttleBottom, racketBottom, shoesBottom, otherBottom) + padding + 44)
  );
  return { slots, height };
}

function calculateBoardHeight(slots: Record<string, LayoutSlot>, instances: BoardInstance[], boardWidth: number) {
  const padding = boardPadding(boardWidth);
  const byId = new Map(instances.map((item) => [item.instanceId, item]));
  let maxBottom = boardMinHeight(boardWidth);

  for (const [instanceId, slot] of Object.entries(slots)) {
    const instance = byId.get(instanceId);
    if (!instance) continue;
    const width = instance.width * slot.scale;
    const height = instance.height * slot.scale;
    const footprint = footprintSize(width, height, slot.rotate);
    const protrudeY = Math.max(0, (footprint.height - height) / 2);
    const bottom = slot.y + height + protrudeY + padding;
    maxBottom = Math.max(maxBottom, bottom);
  }

  return Math.max(boardMinHeight(boardWidth), Math.ceil(maxBottom));
}

function readStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      v: number;
      height: number;
      slots: Record<string, LayoutSlot>;
    };
    if (!parsed || parsed.v !== LAYOUT_VERSION || !parsed.slots) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeExportPixelRatio(width: number, height: number) {
  const MAX_EXPORT_EDGE = 4096;
  const MAX_EXPORT_PIXELS = 12_000_000;
  const edgeRatio = Math.min(MAX_EXPORT_EDGE / Math.max(1, width), MAX_EXPORT_EDGE / Math.max(1, height));
  const areaRatio = Math.sqrt(MAX_EXPORT_PIXELS / Math.max(1, width * height));

  return clamp(Math.min(2.2, edgeRatio, areaRatio), 1, 2.2);
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadCanvasImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

async function measureImageMetrics(url: string): Promise<ImageMetrics | null> {
  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const naturalWidth = img.naturalWidth || 0;
      const naturalHeight = img.naturalHeight || 0;
      if (!naturalWidth || !naturalHeight) {
        resolve(null);
        return;
      }

      const longestEdge = Math.max(naturalWidth, naturalHeight);
      const resizeRatio = longestEdge > 1024 ? 1024 / longestEdge : 1;
      const canvasWidth = Math.max(1, Math.round(naturalWidth * resizeRatio));
      const canvasHeight = Math.max(1, Math.round(naturalHeight * resizeRatio));
      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

      let minX = canvasWidth;
      let minY = canvasHeight;
      let maxX = -1;
      let maxY = -1;
      const points: Array<[number, number]> = [];
      let sumX = 0;
      let sumY = 0;

      const { data } = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const isCutout = /\/cutout\//i.test(url);
      const sampleStep = Math.max(1, Math.floor(Math.max(canvasWidth, canvasHeight) / 520));
      for (let y = 0; y < canvasHeight; y += sampleStep) {
        for (let x = 0; x < canvasWidth; x += sampleStep) {
          const idx = (y * canvasWidth + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          if (a < 12) continue;

          const likelyWhiteBg =
            a > 220 &&
            r >= WHITE_BG_THRESHOLD &&
            g >= WHITE_BG_THRESHOLD &&
            b >= WHITE_BG_THRESHOLD;
          if (!isCutout && likelyWhiteBg) continue;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          points.push([x, y]);
          sumX += x;
          sumY += y;
        }
      }

      const hasDetectedContent = maxX >= minX && maxY >= minY;
      let contentWidth = hasDetectedContent ? maxX - minX + 1 : canvasWidth;
      let contentHeight = hasDetectedContent ? maxY - minY + 1 : canvasHeight;
      let majorLength = Math.max(contentWidth, contentHeight);
      let majorAxisAngleDeg = contentWidth >= contentHeight ? 0 : 90;

      if (hasDetectedContent && points.length >= 64) {
        const cx = sumX / points.length;
        const cy = sumY / points.length;
        let covXX = 0;
        let covXY = 0;
        let covYY = 0;
        for (const [px, py] of points) {
          const dx = px - cx;
          const dy = py - cy;
          covXX += dx * dx;
          covXY += dx * dy;
          covYY += dy * dy;
        }

        const theta = 0.5 * Math.atan2(2 * covXY, covXX - covYY);
        majorAxisAngleDeg = (theta * 180) / Math.PI;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        let minU = Number.POSITIVE_INFINITY;
        let maxU = Number.NEGATIVE_INFINITY;
        let minV = Number.POSITIVE_INFINITY;
        let maxV = Number.NEGATIVE_INFINITY;

        for (const [px, py] of points) {
          const dx = px - cx;
          const dy = py - cy;
          const u = dx * cos + dy * sin;
          const v = -dx * sin + dy * cos;
          if (u < minU) minU = u;
          if (u > maxU) maxU = u;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }

        const orientedWidth = Math.max(1, maxU - minU + 1);
        const orientedHeight = Math.max(1, maxV - minV + 1);
        contentWidth = orientedWidth;
        contentHeight = orientedHeight;
        majorLength = Math.max(orientedWidth, orientedHeight);
      }

      resolve({
        naturalWidth,
        naturalHeight,
        contentAspect: contentWidth / Math.max(1, contentHeight),
        occupancyLongest: majorLength / Math.max(canvasWidth, canvasHeight),
        majorAxisAngleDeg
      });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function normalizeAndTrimCutout(
  url: string,
  rotateDeg: number
): Promise<{ url: string; metrics: ImageMetrics } | null> {
  if (typeof window === "undefined") return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      const naturalWidth = img.naturalWidth || 0;
      const naturalHeight = img.naturalHeight || 0;
      if (!naturalWidth || !naturalHeight) {
        resolve(null);
        return;
      }

      const rad = (rotateDeg * Math.PI) / 180;
      const cos = Math.abs(Math.cos(rad));
      const sin = Math.abs(Math.sin(rad));
      const rotatedWidth = Math.ceil(naturalWidth * cos + naturalHeight * sin) + 4;
      const rotatedHeight = Math.ceil(naturalWidth * sin + naturalHeight * cos) + 4;
      const workCanvas = document.createElement("canvas");
      workCanvas.width = Math.max(1, rotatedWidth);
      workCanvas.height = Math.max(1, rotatedHeight);
      const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
      if (!workCtx) {
        resolve(null);
        return;
      }

      workCtx.clearRect(0, 0, workCanvas.width, workCanvas.height);
      workCtx.translate(workCanvas.width / 2, workCanvas.height / 2);
      workCtx.rotate(rad);
      workCtx.drawImage(img, -naturalWidth / 2, -naturalHeight / 2);
      workCtx.setTransform(1, 0, 0, 1, 0, 0);

      const { data } = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
      let minX = workCanvas.width;
      let minY = workCanvas.height;
      let maxX = -1;
      let maxY = -1;
      const alphaThreshold = 24;

      for (let y = 0; y < workCanvas.height; y++) {
        for (let x = 0; x < workCanvas.width; x++) {
          const idx = (y * workCanvas.width + x) * 4;
          if (data[idx + 3] < alphaThreshold) continue;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < minX || maxY < minY) {
        resolve(null);
        return;
      }

      const margin = 2;
      const cropX = Math.max(0, minX - margin);
      const cropY = Math.max(0, minY - margin);
      const cropW = Math.min(workCanvas.width - cropX, maxX - minX + 1 + margin * 2);
      const cropH = Math.min(workCanvas.height - cropY, maxY - minY + 1 + margin * 2);

      const outCanvas = document.createElement("canvas");
      outCanvas.width = Math.max(1, cropW);
      outCanvas.height = Math.max(1, cropH);
      const outCtx = outCanvas.getContext("2d");
      if (!outCtx) {
        resolve(null);
        return;
      }

      outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
      outCtx.drawImage(workCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const normalizedUrl = outCanvas.toDataURL("image/png");
      resolve({
        url: normalizedUrl,
        metrics: {
          naturalWidth: cropW,
          naturalHeight: cropH,
          contentAspect: cropW / Math.max(1, cropH),
          occupancyLongest: 1,
          majorAxisAngleDeg: 90
        }
      });
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function GearPegboardManager({
  initialItems
}: {
  initialItems: GearWallItem[];
}) {
  const router = useRouter();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const hasInitialized = useRef(false);
  const hasManualLayout = useRef(false);
  const zCounter = useRef(20);
  const dragRef = useRef<{
    instanceId: string;
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const [boardWidth, setBoardWidth] = useState(0);
  const [boardHeight, setBoardHeight] = useState(DESKTOP_BOARD_MIN_HEIGHT);
  const [layout, setLayout] = useState<Record<string, LayoutSlot>>({});
  const [imageMetricsByUrl, setImageMetricsByUrl] = useState<Record<string, ImageMetrics>>({});
  const [normalizedRacketByUrl, setNormalizedRacketByUrl] = useState<Record<string, string>>({});
  const [normalizedRacketMetricsByUrl, setNormalizedRacketMetricsByUrl] = useState<Record<string, ImageMetrics>>({});
  const [showBounds, setShowBounds] = useState(false);
  const [shareMode, setShareMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const urls = [...new Set(initialItems.map((item) => item.coverImageUrl).filter((url): url is string => Boolean(url)))];
    if (!urls.length) return;

    const unresolved = urls.filter((url) => !imageMetricsByUrl[url]);
    if (!unresolved.length) return;

    (async () => {
      const updates: Record<string, ImageMetrics> = {};
      await Promise.all(
        unresolved.map(async (url) => {
          const measured = await measureImageMetrics(url);
          if (measured) updates[url] = measured;
        })
      );

      if (cancelled || Object.keys(updates).length === 0) return;
      setImageMetricsByUrl((prev) => ({ ...prev, ...updates }));
    })();

    return () => {
      cancelled = true;
    };
  }, [imageMetricsByUrl, initialItems]);

  useEffect(() => {
    let cancelled = false;
    const racketUrls = [
      ...new Set(
        initialItems
          .filter((item) => isRacketCategory(resolveCategoryName(item)))
          .map((item) => item.coverImageUrl)
          .filter((url): url is string => Boolean(url))
      )
    ];
    if (!racketUrls.length) return;

    const unresolved = racketUrls.filter((url) => {
      if (normalizedRacketByUrl[url]) return false;
      const metrics = imageMetricsByUrl[url];
      if (!metrics) return false;
      return Math.abs(autoRotateForRacket(metrics)) > 0.4;
    });
    if (!unresolved.length) return;

    (async () => {
      const imageUpdates: Record<string, string> = {};
      const metricUpdates: Record<string, ImageMetrics> = {};

      await Promise.all(
        unresolved.map(async (url) => {
          const metrics = imageMetricsByUrl[url];
          if (!metrics) return;
          const correction = autoRotateForRacket(metrics);
          const normalized = await normalizeAndTrimCutout(url, correction);
          if (!normalized) return;
          imageUpdates[url] = normalized.url;
          metricUpdates[url] = normalized.metrics;
        })
      );

      if (cancelled) return;
      if (Object.keys(imageUpdates).length) {
        setNormalizedRacketByUrl((prev) => ({ ...prev, ...imageUpdates }));
      }
      if (Object.keys(metricUpdates).length) {
        setNormalizedRacketMetricsByUrl((prev) => ({ ...prev, ...metricUpdates }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageMetricsByUrl, initialItems, normalizedRacketByUrl]);

  const instances = useMemo<BoardInstance[]>(() => {
    return initialItems.flatMap((item) => {
      const categoryName = resolveCategoryName(item);
      const activeCount = Math.max(0, item.activeQuantity);
      const historyCount = historicalQuantity(item, categoryName);
      const originalImageUrl = item.coverImageUrl ?? null;
      const isRacket = isRacketCategory(categoryName);
      const imageUrl =
        originalImageUrl && isRacket
          ? normalizedRacketByUrl[originalImageUrl] ?? originalImageUrl
          : originalImageUrl;
      const metrics =
        originalImageUrl && isRacket
          ? normalizedRacketMetricsByUrl[originalImageUrl] ?? imageMetricsByUrl[originalImageUrl] ?? null
          : imageUrl
            ? imageMetricsByUrl[imageUrl] ?? null
            : null;
      const size = sizeByCategory(
        categoryName,
        boardWidth || 1120,
        metrics
      );
      const defaultRotate = isRacket
        ? normalizedRacketByUrl[originalImageUrl ?? ""] ? 0 : autoRotateForRacket(metrics)
        : 0;

      const activeInstances = Array.from({ length: activeCount }, (_, index) => ({
        instanceId: `${item.id}::active::${index}`,
        gearId: item.id,
        name: item.name,
        categoryName,
        brandName: item.brand?.name ?? "",
        modelName: item.modelCode ?? item.name,
        imageUrl,
        width: size.width,
        height: size.height,
        defaultRotate,
        active: true,
        historyType: null,
        indexInGroup: index + 1
      }));

      if (!showHistory || historyCount <= 0) {
        return activeInstances;
      }

      const historyType: BoardInstance["historyType"] = isShuttleCategory(categoryName) ? "usedUp" : "wornOut";
      const historyInstances = Array.from({ length: historyCount }, (_, index) => ({
        instanceId: `${item.id}::history::${index}`,
        gearId: item.id,
        name: item.name,
        categoryName,
        brandName: item.brand?.name ?? "",
        modelName: item.modelCode ?? item.name,
        imageUrl,
        width: size.width,
        height: size.height,
        defaultRotate,
        active: false,
        historyType,
        indexInGroup: activeCount + index + 1
      }));

      return [...activeInstances, ...historyInstances];
    });
  }, [
    boardWidth,
    showHistory,
    imageMetricsByUrl,
    initialItems,
    normalizedRacketByUrl,
    normalizedRacketMetricsByUrl
  ]);

  const instancesKey = useMemo(() => instances.map((item) => item.instanceId).join("|"), [instances]);
  const instanceById = useMemo(
    () => new Map(instances.map((item) => [item.instanceId, item])),
    [instances]
  );

  const zoneGuides = useMemo(() => {
    const zoneGap = sectionGap(boardWidth || 1120);
    let shuttleBottom = 0;
    let racketBottom = 0;
    let hasShuttle = false;
    let hasRacket = false;

    for (const instance of instances) {
      const slot = layout[instance.instanceId];
      if (!slot) continue;
      const width = instance.width * slot.scale;
      const height = instance.height * slot.scale;
      const footprint = footprintSize(width, height, slot.rotate);
      const protrudeY = Math.max(0, (footprint.height - height) / 2);
      const bottom = slot.y + height + protrudeY;

      if (isShuttleCategory(instance.categoryName)) {
        hasShuttle = true;
        shuttleBottom = Math.max(shuttleBottom, bottom);
      } else if (isRacketCategory(instance.categoryName)) {
        hasRacket = true;
        racketBottom = Math.max(racketBottom, bottom);
      }
    }

    const shuttleDividerY = hasShuttle ? shuttleBottom + zoneGap / 2 : null;
    const racketDividerY =
      hasRacket && shuttleDividerY
        ? Math.max(shuttleDividerY + zoneGap / 2, racketBottom + zoneGap / 2)
        : hasRacket
          ? racketBottom + zoneGap / 2
          : null;

    return {
      shuttleDividerY,
      racketDividerY
    };
  }, [boardWidth, instances, layout]);

  useEffect(() => {
    const node = boardRef.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.max(260, Math.floor(entries[0]?.contentRect.width ?? 0));
      setBoardWidth((prev) => (prev !== nextWidth ? nextWidth : prev));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (boardWidth <= 0) return;

    const recommended = recommendLayout(instances, boardWidth);
    const stored = readStorage();

    if (!hasInitialized.current) {
      const initialSlots: Record<string, LayoutSlot> = {};
      const candidateHeight = Math.max(recommended.height, stored?.height ?? boardMinHeight(boardWidth));
      hasManualLayout.current = Boolean(stored);

      for (const instance of instances) {
        const rawSlot = stored?.slots?.[instance.instanceId] ?? recommended.slots[instance.instanceId];
        initialSlots[instance.instanceId] = clampSlot(rawSlot, instance, boardWidth, candidateHeight);
        zCounter.current = Math.max(zCounter.current, initialSlots[instance.instanceId].z);
      }

      const initialHeight = calculateBoardHeight(initialSlots, instances, boardWidth);
      setBoardHeight(initialHeight);
      setLayout(initialSlots);
      hasInitialized.current = true;
      return;
    }

    if (!hasManualLayout.current) {
      setLayout(recommended.slots);
      setBoardHeight(recommended.height);
      return;
    }

    setLayout((prev) => {
      const merged: Record<string, LayoutSlot> = {};
      const nextHeight = Math.max(boardHeight, recommended.height);

      for (const instance of instances) {
        const rawSlot = prev[instance.instanceId] ?? recommended.slots[instance.instanceId];
        merged[instance.instanceId] = clampSlot(rawSlot, instance, boardWidth, nextHeight);
        zCounter.current = Math.max(zCounter.current, merged[instance.instanceId].z);
      }
      return merged;
    });
    setBoardHeight((prev) => Math.max(prev, recommended.height));
  }, [boardWidth, boardHeight, instances, instancesKey]);

  useEffect(() => {
    if (!hasInitialized.current || typeof window === "undefined") return;

    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          v: LAYOUT_VERSION,
          height: boardHeight,
          slots: layout
        })
      );
    }, 120);

    return () => window.clearTimeout(timer);
  }, [boardHeight, layout]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const dragging = dragRef.current;
      if (!dragging || event.pointerId !== dragging.pointerId) return;
      const node = boardRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const dx = pointerX - dragging.startPointerX;
      const dy = pointerY - dragging.startPointerY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragging.moved = true;
      }

      const instance = instanceById.get(dragging.instanceId);
      if (!instance) return;

      setLayout((prev) => {
        const slot = prev[dragging.instanceId];
        if (!slot) return prev;
        const nextMap = {
          ...prev,
          [dragging.instanceId]: clampSlot(
            {
              ...slot,
              x: dragging.startX + dx,
              y: dragging.startY + dy
            },
            instance,
            boardWidth,
            boardHeight
          )
        };
        setBoardHeight(calculateBoardHeight(nextMap, instances, boardWidth));
        return nextMap;
      });
    };

    const onUp = () => {
      const dragging = dragRef.current;
      if (!dragging) return;
      const instance = instanceById.get(dragging.instanceId);
      if (dragging.moved) {
        hasManualLayout.current = true;
      }
      if (instance && !dragging.moved) {
        router.push(`/gear/${instance.gearId}`);
      }
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [boardHeight, boardWidth, instanceById, instances, router]);

  function applyRecommendedLayout() {
    if (boardWidth <= 0) return;
    const recommended = recommendLayout(instances, boardWidth);
    hasManualLayout.current = false;
    setLayout(recommended.slots);
    setBoardHeight(recommended.height);
  }

  function resetLayout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    hasManualLayout.current = false;
    applyRecommendedLayout();
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>, instanceId: string) {
    const slot = layout[instanceId];
    if (!slot) return;
    const node = boardRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const nextZ = zCounter.current + 1;
    zCounter.current = nextZ;

    dragRef.current = {
      instanceId,
      pointerId: event.pointerId,
      startPointerX: pointerX,
      startPointerY: pointerY,
      startX: slot.x,
      startY: slot.y,
      moved: false
    };

    setLayout((prev) => ({
      ...prev,
      [instanceId]: { ...prev[instanceId], z: nextZ }
    }));
  }

  async function exportBoardImage() {
    if (isExporting) return;
    const node = boardRef.current;
    if (!node) return;

    const hadBounds = showBounds;
    setIsExporting(true);
    if (hadBounds) setShowBounds(false);

    try {
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
      });

      const exportWidth = Math.max(node.clientWidth, Math.ceil(boardWidth || node.scrollWidth || node.clientWidth));
      const exportHeight = Math.max(node.clientHeight, Math.ceil(renderBoardHeight));
      const pixelRatio = safeExportPixelRatio(exportWidth, exportHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(exportWidth * pixelRatio);
      canvas.height = Math.round(exportHeight * pixelRatio);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("无法创建导出画布");
      }

      ctx.scale(pixelRatio, pixelRatio);

      const isDarkTheme = document.documentElement.getAttribute("data-theme") === "dark";
      const boardRadius = 32;
      const boardGradient = ctx.createLinearGradient(0, 0, 0, exportHeight);
      if (isDarkTheme) {
        boardGradient.addColorStop(0, "#1d1f24");
        boardGradient.addColorStop(1, "#15171b");
      } else {
        boardGradient.addColorStop(0, "#fafbfc");
        boardGradient.addColorStop(1, "#f2f3f5");
      }

      roundedRectPath(ctx, 0, 0, exportWidth, exportHeight, boardRadius);
      ctx.fillStyle = boardGradient;
      ctx.fill();

      ctx.save();
      roundedRectPath(ctx, 0, 0, exportWidth, exportHeight, boardRadius);
      ctx.clip();

      ctx.fillStyle = isDarkTheme ? "rgba(228,228,231,0.14)" : "rgba(82,82,91,0.18)";
      for (let y = 12; y < exportHeight; y += 24) {
        for (let x = 12; x < exportWidth; x += 24) {
          ctx.beginPath();
          ctx.arc(x, y, 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const overlayGradient = ctx.createLinearGradient(0, 0, 0, exportHeight * 0.42);
      if (isDarkTheme) {
        overlayGradient.addColorStop(0, "rgba(255,255,255,0.04)");
        overlayGradient.addColorStop(1, "rgba(255,255,255,0)");
      } else {
        overlayGradient.addColorStop(0, "rgba(255,255,255,0.68)");
        overlayGradient.addColorStop(1, "rgba(255,255,255,0)");
      }
      ctx.fillStyle = overlayGradient;
      ctx.fillRect(0, 0, exportWidth, exportHeight);

      const imageEntries = await Promise.allSettled(
        [...new Set(instances.map((item) => item.imageUrl).filter((value): value is string => Boolean(value)))].map(async (url) => [
          url,
          await loadCanvasImage(url)
        ] as const)
      );
      const imageMap = new Map<string, HTMLImageElement>();
      for (const entry of imageEntries) {
        if (entry.status === "fulfilled") {
          imageMap.set(entry.value[0], entry.value[1]);
        }
      }

      const drawableInstances = [...instances]
        .map((instance) => ({ instance, slot: layout[instance.instanceId] }))
        .filter((item): item is { instance: BoardInstance; slot: LayoutSlot } => Boolean(item.slot))
        .sort((a, b) => a.slot.z - b.slot.z);

      for (const { instance, slot } of drawableInstances) {
        const width = instance.width * slot.scale;
        const height = instance.height * slot.scale;

        ctx.save();
        ctx.translate(slot.x + width / 2, slot.y + height / 2);
        ctx.rotate((slot.rotate * Math.PI) / 180);

        if (!instance.active) {
          if (instance.historyType === "usedUp") {
            ctx.globalAlpha = 0.3;
            ctx.filter = "grayscale(45%) saturate(75%)";
          } else {
            ctx.globalAlpha = 0.45;
            ctx.filter = "grayscale(75%) saturate(80%)";
          }
        }

        const image = instance.imageUrl ? imageMap.get(instance.imageUrl) : null;
        if (image) {
          ctx.drawImage(image, -width / 2, -height / 2, width, height);
        } else {
          roundedRectPath(ctx, -width / 2, -height / 2, width, height, 18);
          ctx.fillStyle = isDarkTheme ? "rgba(46,48,54,0.82)" : "rgba(255,255,255,0.9)";
          ctx.fill();
          ctx.lineWidth = 1;
          ctx.strokeStyle = isDarkTheme ? "rgba(255,255,255,0.1)" : "rgba(15,23,42,0.08)";
          ctx.stroke();
          ctx.filter = "none";
          ctx.globalAlpha = 1;
          ctx.fillStyle = isDarkTheme ? "rgba(235,235,245,0.72)" : "rgba(28,28,30,0.62)";
          ctx.font = "12px -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(instance.name, 0, 0, Math.max(64, width - 18));
        }

        ctx.restore();
      }

      ctx.restore();

      roundedRectPath(ctx, 0.5, 0.5, exportWidth - 1, exportHeight - 1, boardRadius);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDarkTheme ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.08)";
      ctx.stroke();

      const dataUrl = canvas.toDataURL("image/png");
      const fileName = `pegboard-${new Date().toISOString().slice(0, 10)}.png`;
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };

      if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
        await nav.share({
          title: "我的羽球洞洞板",
          text: "我的羽毛球装备墙",
          files: [file]
        });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } finally {
      if (hadBounds) setShowBounds(true);
      setIsExporting(false);
    }
  }

  const renderBoardHeight = shareMode
    ? Math.max(boardHeight, Math.round((boardWidth || 900) * 1.22))
    : boardHeight;

  const boardModes = [
    { id: "active", label: "仅在用" },
    { id: "history", label: "完整历史" }
  ];

  if (initialItems.length === 0) {
    return (
      <Card className="py-14 text-center">
        <p className="text-text-mute">还没有可展示装备，先去购买记录新增一条。</p>
        <div className="mt-4">
          <Link href="/purchases">
            <Button>新增购买记录</Button>
          </Link>
        </div>
      </Card>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="space-y-4">
        <ControlPanel>
          <SegmentedControl
            options={boardModes}
            value={showHistory ? "history" : "active"}
            onChange={(v) => setShowHistory(v === "history")}
          />
        </ControlPanel>
        <Card className="py-14 text-center">
          <p className="text-text-mute">当前没有在用装备，切到“显示历史”可以查看已用完或已退役的装备。</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ControlPanel
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={applyRecommendedLayout} className="px-3">
              <Sparkles size={14} className="mr-1.5" />
              推荐布局
            </Button>
            <Button variant="secondary" size="sm" onClick={resetLayout} className="px-3">
              <RotateCcw size={14} className="mr-1.5" />
              重置
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowBounds((prev) => !prev)} className="px-3">
              {showBounds ? "隐藏边框" : "显示边框"}
            </Button>
            <div className="mx-1 h-4 w-px bg-border/60" />
            <Button variant="secondary" size="sm" onClick={() => setShareMode((prev) => !prev)} className="px-3">
              {shareMode ? "常规视图" : "分享模式"}
            </Button>
            <Button variant="primary" size="sm" onClick={exportBoardImage} disabled={isExporting} className="px-4">
              <ImageDown size={14} className="mr-1.5" />
              {isExporting ? "导出中..." : "保存图片"}
            </Button>
          </div>
        }
      >
        <SegmentedControl
          options={boardModes}
          value={showHistory ? "history" : "active"}
          onChange={(v) => setShowHistory(v === "history")}
        />
      </ControlPanel>

      <Card className="p-4 sm:p-6">
        <div
          ref={boardRef}
          className={cn(
            "pegboard-surface relative w-full overflow-hidden rounded-[2rem] border border-border",
            shareMode ? "pegboard-surface-share" : ""
          )}
          style={{ height: renderBoardHeight }}
        >
          {!shareMode && showBounds && zoneGuides.shuttleDividerY ? (
            <div
              aria-hidden
              className="pointer-events-none absolute border-t border-dashed border-text-mute/35"
              style={{ top: zoneGuides.shuttleDividerY, left: boardPadding(boardWidth) + 4, right: boardPadding(boardWidth) + 4 }}
            />
          ) : null}
          {!shareMode && showBounds && zoneGuides.racketDividerY ? (
            <div
              aria-hidden
              className="pointer-events-none absolute border-t border-dashed border-text-mute/25"
              style={{ top: zoneGuides.racketDividerY, left: boardPadding(boardWidth) + 4, right: boardPadding(boardWidth) + 4 }}
            />
          ) : null}
          {instances.map((instance) => {
            const slot = layout[instance.instanceId];
            if (!slot) return null;

            const width = instance.width * slot.scale;
            const height = instance.height * slot.scale;

            return (
              <div
                key={instance.instanceId}
                className="absolute cursor-grab select-none touch-none active:cursor-grabbing"
                style={{
                  left: slot.x,
                  top: slot.y,
                  width,
                  height,
                  zIndex: slot.z,
                  transform: `rotate(${slot.rotate}deg)`,
                  transformOrigin: "center center"
                }}
                onPointerDown={(event) => onPointerDown(event, instance.instanceId)}
              >
                {instance.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={instance.imageUrl}
                    alt={instance.name}
                    draggable={false}
                    className={cn(
                      "pointer-events-none h-full w-full object-contain",
                      "gear-cutout-flat",
                      instance.active
                        ? ""
                        : instance.historyType === "usedUp"
                          ? "opacity-30 grayscale-[0.45] saturate-[0.75]"
                          : "opacity-45 grayscale-[0.75] saturate-[0.8]"
                    )}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-3xl border border-dashed border-border bg-panel-2/70 text-sm text-text-mute">
                    {instance.name}
                  </div>
                )}
                {showBounds ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 rounded-[8px] border border-dashed border-sky-500/85"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
