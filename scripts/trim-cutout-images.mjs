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

function clampInt(n, min, max) {
  return Math.max(min, Math.min(max, n | 0));
}

function computeAlphaBBox(alpha, width, height, alphaThreshold) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // alpha 是 0..255，threshold 也是 0..255
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x += 1) {
      if (alpha[rowOffset + x] > alphaThreshold) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

async function trimPng(filePath, { padding, threshold }) {
  const img = sharp(filePath, { failOn: "none" }).ensureAlpha();
  const before = await img.metadata();
  if (!before.width || !before.height) return null;

  // 用 alpha 通道算 bbox，比 sharp.trim 稳定可控
  const { data, info } = await img
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;

  // RGBA raw：alpha 在第 4 个通道
  const alpha = new Uint8Array(width * height);
  for (let i = 0, j = 3; i < alpha.length; i += 1, j += 4) {
    alpha[i] = data[j];
  }

  // threshold: 0..255，默认 10 表示 alpha<=10 视为透明
  const alphaThreshold = clampInt(threshold, 0, 255);
  const bbox = computeAlphaBBox(alpha, width, height, alphaThreshold);
  if (!bbox) return null;

  const withPad = {
    left: clampInt(bbox.left - padding, 0, width - 1),
    top: clampInt(bbox.top - padding, 0, height - 1),
    width: clampInt(bbox.width + padding * 2, 1, width),
    height: clampInt(bbox.height + padding * 2, 1, height)
  };

  const cropped = await sharp(filePath, { failOn: "none" })
    .extract(withPad)
    .png({ compressionLevel: 9 })
    .toBuffer();

  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, cropped);
  await fs.rename(tempPath, filePath);

  return {
    before: `${before.width}x${before.height}`,
    after: `${withPad.width}x${withPad.height}`
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

