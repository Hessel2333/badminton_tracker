import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

type SourceName = "cloud" | "local";

type CliOptions = {
  source: SourceName;
  userEmail?: string;
  outDir: string;
};

type BackupFile = {
  originalURLString: string;
  relativePath: string;
  dataBase64?: string;
};

type BackupManifest = {
  formatVersion: number;
  exportedAt: string;
  data: {
    version: number;
    purchases: unknown[];
    wishlistItems: unknown[];
    pegboardLayouts: unknown;
  };
  files: BackupFile[];
};

function parseArgs(): CliOptions {
  const options: CliOptions = {
    source: "cloud",
    outDir: path.join(process.cwd(), "output", "ios-backups")
  };

  for (const arg of process.argv.slice(2)) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "source" && (value === "cloud" || value === "local")) {
      options.source = value;
    } else if (key === "user-email" && value) {
      options.userEmail = value;
    } else if (key === "out-dir" && value) {
      options.outDir = path.resolve(value);
    }
  }

  return options;
}

function readEnv(source: SourceName) {
  const fileName = source === "cloud" ? ".env" : ".env.local";
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`${fileName} not found.`);
  }

  const env = dotenv.parse(fs.readFileSync(filePath, "utf8"));
  if (!env.DATABASE_URL) {
    throw new Error(`DATABASE_URL missing in ${fileName}.`);
  }
  return env;
}

function toNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toString" in value) return Number(value.toString());
  return Number(value);
}

function toIsoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function imageKeyFromUrl(value?: string | null) {
  if (!value) return null;

  const rawPath = (() => {
    try {
      return new URL(value, "https://badmintontracker.local").pathname;
    } catch {
      return value;
    }
  })();

  const fileName = decodeURIComponent(rawPath.split("/").filter(Boolean).pop() ?? "");
  if (!fileName) return null;
  return fileName.replace(/\.[a-z0-9]+$/i, "");
}

function safeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function maybeLocalFileUrl(value?: string | null) {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "file:") return null;
  return fs.existsSync(url.pathname) ? url : null;
}

async function resolveUser(prisma: PrismaClient, userEmail?: string) {
  if (userEmail) {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) throw new Error(`User not found: ${userEmail}`);
    return user;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: {
          purchases: true,
          wishlistItems: true
        }
      }
    }
  });
  if (users.length === 0) throw new Error("No users found.");
  if (users.length === 1) return users[0];
  return [...users].sort((left, right) => {
    const leftScore = left._count.purchases * 10 + left._count.wishlistItems;
    const rightScore = right._count.purchases * 10 + right._count.wishlistItems;
    return rightScore - leftScore;
  })[0];
}

async function main() {
  const options = parseArgs();
  const env = readEnv(options.source);
  const prisma = new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
    log: ["error", "warn"]
  });

  try {
    const user = await resolveUser(prisma, options.userEmail ?? env.IOS_BACKUP_USER_EMAIL);
    const [purchases, wishlistItems, preference] = await Promise.all([
      prisma.purchaseRecord.findMany({
        where: { userId: user.id },
        orderBy: { purchaseDate: "desc" },
        select: {
          id: true,
          itemNameSnapshot: true,
          unitPriceCny: true,
          quantity: true,
          totalPriceCny: true,
          itemStatus: true,
          purchaseDate: true,
          channel: true,
          notes: true,
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          gearItem: {
            select: {
              id: true,
              modelCode: true,
              coverImageUrl: true
            }
          }
        }
      }),
      prisma.wishlistItem.findMany({
        where: { userId: user.id },
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        include: {
          brand: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } }
        }
      }),
      prisma.userPreference.findUnique({
        where: { userId: user.id },
        select: { pegboardLayouts: true }
      })
    ]);

    const data = {
      version: 1,
      purchases: purchases.map((item) => ({
        id: item.id,
        itemNameSnapshot: item.itemNameSnapshot,
        unitPriceCny: toNumber(item.unitPriceCny),
        quantity: item.quantity,
        totalPriceCny: toNumber(item.totalPriceCny),
        itemStatus: item.itemStatus,
        purchaseDate: toIsoDate(item.purchaseDate),
        channel: item.channel,
        notes: item.notes,
        brand: item.brand,
        category: item.category,
        gearItem: item.gearItem
          ? {
            id: item.gearItem.id,
            modelCode: item.gearItem.modelCode,
            coverImageUrl: item.gearItem.coverImageUrl,
            imageKey: imageKeyFromUrl(item.gearItem.coverImageUrl)
          }
          : null
      })),
      wishlistItems: wishlistItems.map((item) => ({
        id: item.id,
        name: item.name,
        targetPriceCny: toNumber(item.targetPriceCny),
        currentSeenPriceCny: toNumber(item.currentSeenPriceCny),
        priority: item.priority,
        status: item.status,
        sourceUrl: item.sourceUrl,
        imageUrl: item.imageUrl,
        notes: item.notes,
        brand: item.brand,
        category: item.category
      })),
      pegboardLayouts: preference?.pegboardLayouts ?? {}
    };

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(options.outDir, `badminton-tracker-${options.source}-${timestamp}.btbackup`);
    fs.mkdirSync(options.outDir, { recursive: true });

    const files: BackupFile[] = [];
    const imageUrls = [
      ...data.purchases.map((item) => item.gearItem?.coverImageUrl),
      ...data.wishlistItems.map((item) => item.imageUrl)
    ];
    const seen = new Set<string>();

    for (const value of imageUrls) {
      if (!value || seen.has(value)) continue;
      const localUrl = maybeLocalFileUrl(value);
      if (!localUrl) continue;

      seen.add(value);
      const fileName = `${files.length + 1}-${safeFileName(path.basename(localUrl.pathname))}`;
      files.push({
        originalURLString: value,
        relativePath: `photos/${fileName}`,
        dataBase64: fs.readFileSync(localUrl.pathname).toString("base64")
      });
    }

    const manifest: BackupManifest = {
      formatVersion: 2,
      exportedAt: new Date().toISOString(),
      data,
      files
    };
    fs.writeFileSync(backupPath, JSON.stringify(manifest, null, 2));

    console.log(`Backup package: ${backupPath}`);
    console.log(`User: ${user.email}`);
    console.log(`Purchases: ${data.purchases.length}`);
    console.log(`Wishlist: ${data.wishlistItems.length}`);
    console.log(`Photos: ${files.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Export failed:", error);
  process.exit(1);
});
