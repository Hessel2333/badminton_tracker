import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM_CATEGORIES = ["球拍", "球鞋", "羽毛球", "球线", "包", "服饰", "护具", "其他"];
const DEFAULT_RATING_DIMENSIONS = [
  { key: "power", label: "进攻", weight: 1, sortOrder: 0 },
  { key: "control", label: "控制", weight: 1, sortOrder: 1 },
  { key: "durability", label: "耐用", weight: 1, sortOrder: 2 },
  { key: "comfort", label: "舒适", weight: 1, sortOrder: 3 },
  { key: "value", label: "性价比", weight: 1, sortOrder: 4 }
];

async function main() {
  const adminIdentifier = process.env.ADMIN_USERNAME ?? process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminIdentifier || !adminPassword) {
    throw new Error(
      "Missing ADMIN_USERNAME (or ADMIN_EMAIL fallback) / ADMIN_PASSWORD in environment variables."
    );
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminIdentifier },
    update: { passwordHash },
    create: {
      email: adminIdentifier,
      passwordHash,
      role: "ADMIN"
    }
  });

  await Promise.all(
    SYSTEM_CATEGORIES.map((name, index) =>
      prisma.category.upsert({
        where: { name },
        update: { sortOrder: index, isSystem: true },
        create: { name, sortOrder: index, isSystem: true }
      })
    )
  );

  await Promise.all(
    DEFAULT_RATING_DIMENSIONS.map((item) =>
      prisma.ratingDimension.upsert({
        where: { key: item.key },
        update: {
          label: item.label,
          weight: item.weight,
          sortOrder: item.sortOrder,
          isActive: true
        },
        create: {
          key: item.key,
          label: item.label,
          weight: item.weight,
          sortOrder: item.sortOrder,
          isActive: true
        }
      })
    )
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
