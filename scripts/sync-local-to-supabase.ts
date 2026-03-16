import fs from "node:fs";
import path from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

type EnvMap = Record<string, string>;

function readEnvFile(filePath: string): EnvMap {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  return dotenv.parse(raw);
}

function requiredEnv(env: EnvMap, key: string) {
  const value = env[key];
  if (!value) {
    throw new Error(`Missing ${key} in env file.`);
  }
  return value;
}

function hostFromUrl(url: string) {
  const match = url.match(/@([^:/?]+)/);
  return match?.[1] ?? "unknown";
}

function ensureForceMode() {
  if (process.argv.includes("--force")) return;

  throw new Error(
    "This command deletes all supported data in Supabase before re-importing local data. Re-run with --force to continue."
  );
}

async function main() {
  ensureForceMode();

  const root = process.cwd();
  const cloudEnv = readEnvFile(path.join(root, ".env"));
  const localEnv = readEnvFile(path.join(root, ".env.local"));

  const sourceUrl = requiredEnv(localEnv, "DATABASE_URL");
  const targetUrl = cloudEnv.DIRECT_URL ?? requiredEnv(cloudEnv, "DATABASE_URL");

  if (sourceUrl === targetUrl) {
    throw new Error("Source and target DATABASE_URL are identical; refuse to sync.");
  }

  console.log(`Sync start: ${hostFromUrl(sourceUrl)} -> ${hostFromUrl(targetUrl)}`);

  const source = new PrismaClient({
    datasources: { db: { url: sourceUrl } },
    log: ["error", "warn"]
  });
  const target = new PrismaClient({
    datasources: { db: { url: targetUrl } },
    log: ["error", "warn"]
  });

  try {
    const [
      users,
      brands,
      categories,
      ratingDimensions,
      gearItems,
      gearRatings,
      externalReviews,
      purchaseRecords,
      purchaseEvents,
      wishlistItems,
      wishlistTransitions,
      activitySessions,
      projectCatalogOverrides
    ] = await Promise.all([
      source.user.findMany(),
      source.brand.findMany(),
      source.category.findMany(),
      source.ratingDimension.findMany(),
      source.gearItem.findMany(),
      source.gearRating.findMany(),
      source.externalReview.findMany(),
      source.purchaseRecord.findMany(),
      source.purchaseEvent.findMany(),
      source.wishlistItem.findMany(),
      source.wishlistTransition.findMany(),
      source.activitySession.findMany(),
      source.projectCatalogOverride.findMany()
    ]);

    // Supabase pooler-backed session connections can drop long interactive transactions.
    // This sync is local-authoritative, so sequential writes are safer than one huge transaction.
    await target.wishlistTransition.deleteMany();
    await target.purchaseEvent.deleteMany();
    await target.externalReview.deleteMany();
    await target.gearRating.deleteMany();
    await target.purchaseRecord.deleteMany();
    await target.wishlistItem.deleteMany();
    await target.gearItem.deleteMany();
    await target.projectCatalogOverride.deleteMany();
    await target.ratingDimension.deleteMany();
    await target.brand.deleteMany();
    await target.category.deleteMany();
    await target.activitySession.deleteMany();
    await target.user.deleteMany();

    if (users.length) await target.user.createMany({ data: users });
    if (brands.length) await target.brand.createMany({ data: brands });
    if (categories.length) await target.category.createMany({ data: categories });
    if (ratingDimensions.length) {
      await target.ratingDimension.createMany({ data: ratingDimensions });
    }
    if (gearItems.length) {
      await target.gearItem.createMany({
        data: gearItems.map((item) => ({
          ...item,
          specJson: item.specJson === null ? Prisma.JsonNull : item.specJson
        }))
      });
    }
    if (gearRatings.length) {
      await target.gearRating.createMany({ data: gearRatings });
    }
    if (externalReviews.length) {
      await target.externalReview.createMany({ data: externalReviews });
    }
    if (purchaseRecords.length) {
      await target.purchaseRecord.createMany({ data: purchaseRecords });
    }
    if (purchaseEvents.length) {
      await target.purchaseEvent.createMany({ data: purchaseEvents });
    }
    if (wishlistItems.length) {
      await target.wishlistItem.createMany({ data: wishlistItems });
    }
    if (wishlistTransitions.length) {
      await target.wishlistTransition.createMany({ data: wishlistTransitions });
    }
    if (activitySessions.length) {
      await target.activitySession.createMany({
        data: activitySessions.map((item) => ({
          ...item,
          metaJson: item.metaJson === null ? Prisma.JsonNull : item.metaJson
        }))
      });
    }
    if (projectCatalogOverrides.length) {
      await target.projectCatalogOverride.createMany({
        data: projectCatalogOverrides.map((item) => ({
          ...item,
          tagsJson: item.tagsJson === null ? Prisma.JsonNull : item.tagsJson
        }))
      });
    }

    console.log(
      `Sync done. users=${users.length}, purchases=${purchaseRecords.length}, purchaseEvents=${purchaseEvents.length}, gear=${gearItems.length}, wishlist=${wishlistItems.length}, catalogOverrides=${projectCatalogOverrides.length}`
    );
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error("Sync failed:", error);
  process.exit(1);
});
