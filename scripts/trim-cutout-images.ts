import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const CUTOUT_DIR = path.join(process.cwd(), "assets", "gear_image", "cutout");
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

async function main() {
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

  const files = (await walkPngFiles(CUTOUT_DIR)).sort();

  const changed: Array<{ file: string; before: string; after: string }> = [];
  let skipped = 0;

  for (const full of files) {
    const result = await trimPng(full);
    if (!result) {
      skipped += 1;
      continue;
    }
    changed.push({
      file: path.relative(CUTOUT_DIR, full),
      before: result.before,
      after: result.after
    });
  }

  console.log(JSON.stringify({ total: files.length, trimmed: changed.length, skipped, changed }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
