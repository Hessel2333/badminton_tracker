import fs from "node:fs/promises";
import path from "node:path";

const ASSET_DIR = path.join(process.cwd(), "assets", "gear_image");
const ORIGINAL_SOURCE_ROOT = path.join(ASSET_DIR, "original");
const CUTOUT_SOURCE_ROOT = path.join(ASSET_DIR, "cutout");
const PUBLIC_BASE_DIR = path.join(process.cwd(), "public", "gear-images");
const PUBLIC_ORIGINAL_DIR = path.join(PUBLIC_BASE_DIR, "original");
const PUBLIC_CUTOUT_DIR = path.join(PUBLIC_BASE_DIR, "cutout");

async function ensureDirectory() {
  await fs.mkdir(PUBLIC_ORIGINAL_DIR, { recursive: true });
  await fs.mkdir(PUBLIC_CUTOUT_DIR, { recursive: true });
}

function isImage(name: string) {
  return /\.(jpg|jpeg|png|webp|avif)$/i.test(name);
}

async function walkImageFiles(rootDir: string): Promise<string[]> {
  const output: string[] = [];
  const entries = await fs.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkImageFiles(full);
      output.push(...nested);
      continue;
    }
    if (!isImage(entry.name)) continue;
    output.push(full);
  }

  return output;
}

async function cleanTargetDir(targetDir: string) {
  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !isImage(entry.name)) continue;
    await fs.unlink(path.join(targetDir, entry.name));
  }
}

async function copyFlattenedFiles(
  sourceRoot: string,
  targetDir: string,
  label: string
) {
  let copied = 0;
  const collisions = new Map<string, string>();
  const imageFiles = await walkImageFiles(sourceRoot);

  await cleanTargetDir(targetDir);

  for (const source of imageFiles) {
    const targetName = path.basename(source);
    const existing = collisions.get(targetName);
    if (existing) {
      throw new Error(
        `[${label}] Filename collision: ${targetName}\n- ${existing}\n- ${source}`
      );
    }
    collisions.set(targetName, source);

    const target = path.join(targetDir, targetName);
    await fs.copyFile(source, target);
    copied += 1;
  }

  return { copied };
}

async function main() {
  await ensureDirectory();
  await cleanTargetDir(PUBLIC_BASE_DIR);

  const original = await copyFlattenedFiles(
    ORIGINAL_SOURCE_ROOT,
    PUBLIC_ORIGINAL_DIR,
    "original"
  );
  const cutout = await copyFlattenedFiles(
    CUTOUT_SOURCE_ROOT,
    PUBLIC_CUTOUT_DIR,
    "cutout"
  );

  console.log(
    `Synced local images: ` +
      `original(copied=${original.copied}), ` +
      `cutout(copied=${cutout.copied})`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
