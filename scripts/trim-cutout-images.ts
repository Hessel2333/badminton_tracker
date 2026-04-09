import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ASSETS_CUTOUT_DIR = path.join(process.cwd(), "assets", "gear_image", "cutout");
const PUBLIC_CUTOUT_DIR = path.join(process.cwd(), "public", "gear-images", "cutout");
const PADDING = 6;

async function trimPng(filePath: string) {
  const source = sharp(filePath, { failOn: "none" }).ensureAlpha();
  const before = await source.metadata();
  if (!before.width || !before.height) return null;

  const { data, info } = await source
    .trim({ threshold: 1 })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  const withPadding = await sharp(data)
    .extend({
      top: PADDING,
      right: PADDING,
      bottom: PADDING,
      left: PADDING,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, withPadding);
  await fs.rename(tempPath, filePath);

  return {
    before: `${before.width}x${before.height}`,
    after: `${info.width + PADDING * 2}x${info.height + PADDING * 2}`
  };
}

async function walkPngFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkPngFiles(full);
      files.push(...nested);
      continue;
    }
    if (!entry.isFile() || !/\.png$/i.test(entry.name)) continue;
    files.push(full);
  }

  return files;
}

function resolveTargetDirs() {
  const args = process.argv.slice(2);
  const dirs: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--dir") {
      const next = args[i + 1];
      if (next) dirs.push(path.isAbsolute(next) ? next : path.join(process.cwd(), next));
      i += 1;
      continue;
    }
    if (token === "--assets") dirs.push(ASSETS_CUTOUT_DIR);
    if (token === "--public") dirs.push(PUBLIC_CUTOUT_DIR);
  }

  if (!dirs.length) {
    return [ASSETS_CUTOUT_DIR, PUBLIC_CUTOUT_DIR];
  }
  return dirs;
}

async function main() {
  const targetDirs = resolveTargetDirs();
  const outputs: Array<{
    baseDir: string;
    total: number;
    trimmed: number;
    skipped: number;
    changed: Array<{ file: string; before: string; after: string }>;
  }> = [];

  for (const baseDir of targetDirs) {
    let files: string[] = [];
    try {
      files = (await walkPngFiles(baseDir)).sort();
    } catch {
      outputs.push({ baseDir, total: 0, trimmed: 0, skipped: 0, changed: [] });
      continue;
    }

    const changed: Array<{ file: string; before: string; after: string }> = [];
    let skipped = 0;

    for (const full of files) {
      const result = await trimPng(full);
      if (!result) {
        skipped += 1;
        continue;
      }
      changed.push({
        file: path.relative(baseDir, full),
        before: result.before,
        after: result.after
      });
    }

    outputs.push({
      baseDir,
      total: files.length,
      trimmed: changed.length,
      skipped,
      changed
    });
  }

  console.log(JSON.stringify({ padding: PADDING, outputs }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
