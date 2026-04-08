import { unstable_cache } from "next/cache";

import type { GearWallItem } from "@/components/forms/gear-wall-types";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/server/number";

export const ARCHIVE_ITEMS_TAG = "archive-items";

async function queryArchiveItems(): Promise<GearWallItem[]> {
  // 用 SQL 在服务端聚合出 GearWallItem 所需的“总量/在用/用完/损坏 + 最近一次购入信息 + 最近评分”，
  // 避免 Prisma include 把所有 purchases 全量拉回再在 JS 里 reduce/sort（会导致 RSC 渲染变慢）。
  const rows = await prisma.$queryRawUnsafe<Array<{
    id: string;
    name: string;
    cover_image_url: string | null;
    model_code: string | null;
    created_at: Date;
    brand_name: string | null;
    category_name: string | null;
    latest_purchase_date: Date | null;
    reference_unit_price_cny: string | number | null;
    latest_rating_overall: string | number | null;
    total_quantity: bigint | number;
    active_quantity: bigint | number;
    used_up_quantity: bigint | number;
    worn_out_quantity: bigint | number;
  }>>(`
    SELECT
      g.id,
      g.name,
      g.cover_image_url,
      g.model_code,
      g.created_at,
      b.name AS brand_name,
      c.name AS category_name,

      lp.latest_purchase_date,
      lp.reference_unit_price_cny,

      rl.latest_rating_overall,

      ps.total_quantity,
      ps.active_quantity,
      ps.used_up_quantity,
      ps.worn_out_quantity
    FROM gear_items g
    LEFT JOIN brands b ON b.id = g.brand_id
    LEFT JOIN categories c ON c.id = g.category_id

    -- 聚合：一次性算出各状态数量与总量
    JOIN LATERAL (
      SELECT
        COALESCE(SUM(pr.quantity), 0) AS total_quantity,
        COALESCE(SUM(pr.quantity) FILTER (WHERE pr.item_status IN ('IN_USE', 'STORED')), 0) AS active_quantity,
        COALESCE(SUM(pr.quantity) FILTER (WHERE pr.item_status = 'USED_UP'), 0) AS used_up_quantity,
        COALESCE(SUM(pr.quantity) FILTER (WHERE pr.item_status = 'WORN_OUT'), 0) AS worn_out_quantity
      FROM purchase_records pr
      WHERE pr.gear_item_id = g.id
    ) ps ON TRUE

    -- 最近一次购入（用于 latestPurchaseDate + referenceUnitPriceCny）
    LEFT JOIN LATERAL (
      SELECT
        pr.purchase_date AS latest_purchase_date,
        pr.unit_price_cny AS reference_unit_price_cny
      FROM purchase_records pr
      WHERE pr.gear_item_id = g.id
      ORDER BY pr.purchase_date DESC
      LIMIT 1
    ) lp ON TRUE

    -- 最近评分（用于 ratings[0].overall）
    LEFT JOIN LATERAL (
      SELECT
        gr.overall AS latest_rating_overall
      FROM gear_ratings gr
      WHERE gr.gear_item_id = g.id
      ORDER BY gr.rated_at DESC
      LIMIT 1
    ) rl ON TRUE

    WHERE EXISTS (
      SELECT 1
      FROM purchase_records pr
      WHERE pr.gear_item_id = g.id
    )
    ORDER BY g.created_at DESC
  `);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    coverImageUrl: row.cover_image_url,
    modelCode: row.model_code,
    createdAt: row.created_at.toISOString(),

    latestPurchaseDate: row.latest_purchase_date ? row.latest_purchase_date.toISOString() : null,
    referenceUnitPriceCny: row.reference_unit_price_cny != null ? toNumber(row.reference_unit_price_cny) : null,

    totalQuantity: Number(row.total_quantity),
    activeQuantity: Number(row.active_quantity),
    usedUpQuantity: Number(row.used_up_quantity),
    wornOutQuantity: Number(row.worn_out_quantity),

    brand: row.brand_name ? { name: row.brand_name } : null,
    category: row.category_name ? { name: row.category_name } : null,

    ratings: row.latest_rating_overall != null ? [{ overall: toNumber(row.latest_rating_overall) }] : []
  }));
}

export const getArchiveItems = unstable_cache(queryArchiveItems, ["archive-items"], {
  tags: [ARCHIVE_ITEMS_TAG],
  revalidate: 60
});
