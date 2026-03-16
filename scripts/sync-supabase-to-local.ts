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

async function main() {
  const root = process.cwd();
  const cloudEnv = readEnvFile(path.join(root, ".env"));
  const localEnv = readEnvFile(path.join(root, ".env.local"));

  const sourceUrl = requiredEnv(cloudEnv, "DATABASE_URL");
  const targetUrl = requiredEnv(localEnv, "DATABASE_URL");

  if (sourceUrl === targetUrl) {
    throw new Error("Source and target DATABASE_URL are identical; refuse to sync.");
  }

  console.log(
    `Sync start: ${hostFromUrl(sourceUrl)} -> ${hostFromUrl(targetUrl)}`
  );

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

    await target.$transaction(async (tx) => {
      // Clear existing local data (relation-safe order)
      await tx.wishlistTransition.deleteMany();
      await tx.purchaseEvent.deleteMany();
      await tx.externalReview.deleteMany();
      await tx.gearRating.deleteMany();
      await tx.purchaseRecord.deleteMany();
      await tx.wishlistItem.deleteMany();
      await tx.gearItem.deleteMany();
      await tx.projectCatalogOverride.deleteMany();
      await tx.ratingDimension.deleteMany();
      await tx.brand.deleteMany();
      await tx.category.deleteMany();
      await tx.activitySession.deleteMany();
      await tx.user.deleteMany();

      if (users.length) await tx.user.createMany({ data: users });
      if (brands.length) await tx.brand.createMany({ data: brands });
      if (categories.length) await tx.category.createMany({ data: categories });
      if (ratingDimensions.length) {
        await tx.ratingDimension.createMany({ data: ratingDimensions });
      }
      if (gearItems.length) {
        await tx.gearItem.createMany({
          data: gearItems.map((item) => ({
            ...item,
            specJson: item.specJson === null ? Prisma.JsonNull : item.specJson
          }))
        });
      }
      if (gearRatings.length) await tx.gearRating.createMany({ data: gearRatings });
      if (externalReviews.length) {
        await tx.externalReview.createMany({ data: externalReviews });
      }
      if (purchaseRecords.length) {
        await tx.purchaseRecord.createMany({ data: purchaseRecords });
      }
      if (purchaseEvents.length) {
        await tx.purchaseEvent.createMany({ data: purchaseEvents });
      }
      if (wishlistItems.length) await tx.wishlistItem.createMany({ data: wishlistItems });
      if (wishlistTransitions.length) {
        await tx.wishlistTransition.createMany({ data: wishlistTransitions });
      }
      if (activitySessions.length) {
        await tx.activitySession.createMany({
          data: activitySessions.map((item) => ({
            ...item,
            metaJson: item.metaJson === null ? Prisma.JsonNull : item.metaJson
          }))
        });
      }
      if (projectCatalogOverrides.length) {
        await tx.projectCatalogOverride.createMany({
          data: projectCatalogOverrides.map((item) => ({
            ...item,
            tagsJson: item.tagsJson === null ? Prisma.JsonNull : item.tagsJson
          }))
        });
      }
    });

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
