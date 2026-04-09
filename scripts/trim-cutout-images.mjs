import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ASSETS_CUTOUT_DIR = path.join(process.cwd(), "assets", "gear_image", "cutout");
const PUBLIC_CUTOUT_DIR = path.join(process.cwd(), "public", "gear-images", "cutout");

function parseArgs(argv) {
  const args = argv.slice(2);
  let padding = 6;
  let threshold = 10;
  const dirs = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--padding") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v >= 0) padding = v;
      i += 1;
      continue;
    }
    if (token === "--threshold") {
      const v = Number(args[i + 1]);
      if (Number.isFinite(v) && v >= 0) threshold = v;
      i += 1;
      continue;
    }
    if (token === "--dir") {
      const next = args[i + 1];
      if (next) dirs.push(path.isAbsolute(next) ? next : path.join(process.cwd(), next));
      i += 1;
      continue;
    }
    if (token === "--assets") dirs.push(ASSETS_CUTOUT_DIR);
    if (token === "--public") dirs.push(PUBLIC_CUTOUT_DIR);
  }

  if (!dirs.length) dirs.push(ASSETS_CUTOUT_DIR, PUBLIC_CUTOUT_DIR);

  return { padding, threshold, dirs };
}

async function walkPngFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkPngFiles(full)));
      continue;
    }
    if (!entry.isFile() || !/\.png$/i.test(entry.name)) continue;
    files.push(full);
  }

  return files;
}

async function trimPng(filePath, { padding, threshold }) {
  const source = sharp(filePath, { failOn: "none" }).ensureAlpha();
  const before = await source.metadata();
  if (!before.width || !before.height) return null;

  const { data, info } = await source
    // threshold 调高可以吃掉半透明抗锯齿边，减少“看起来偏短”的透明边距
    .trim({ threshold })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });

  const withPadding = await sharp(data)
    .extend({
      top: padding,
      right: padding,
      bottom: padding,
      left: padding,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png({ compressionLevel: 9 })
    .toBuffer();

  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, withPadding);
  await fs.rename(tempPath, filePath);

  return {
    before: `${before.width}x${before.height}`,
    after: `${info.width + padding * 2}x${info.height + padding * 2}`
  };
}

async function main() {
  const { padding, threshold, dirs } = parseArgs(process.argv);
  const outputs = [];

  for (const baseDir of dirs) {
    let files = [];
    try {
      files = (await walkPngFiles(baseDir)).sort();
    } catch {
      outputs.push({ baseDir, total: 0, trimmed: 0, skipped: 0, changed: [] });
      continue;
    }

    const changed = [];
    let skipped = 0;

    for (const full of files) {
      const result = await trimPng(full, { padding, threshold });
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

  console.log(JSON.stringify({ padding, threshold, outputs }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

