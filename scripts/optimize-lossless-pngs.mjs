import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const targetDir = path.join(root, "public", "gear-images", "cutout");
const minBytes = Number(process.env.MIN_KB ?? 500) * 1024;
const apply = process.argv.includes("--apply");
const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
const backupRoot = path.join(root, "backups", `image-optimization-${timestamp}`);

async function listPngs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listPngs(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      files.push(fullPath);
    }
  }

  return files;
}

async function decodedRaw(buffer) {
  const image = sharp(buffer, { limitInputPixels: false }).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, info };
}

function samePixels(a, b) {
  return (
    a.info.width === b.info.width &&
    a.info.height === b.info.height &&
    a.info.channels === b.info.channels &&
    Buffer.compare(a.data, b.data) === 0
  );
}

function formatBytes(value) {
  return `${(value / 1024).toFixed(1)}KB`;
}

async function optimizeOne(filePath) {
  const original = await fs.readFile(filePath);
  if (original.byteLength < minBytes) return null;

  const optimized = await sharp(original, { limitInputPixels: false })
    .png({
      adaptiveFiltering: true,
      compressionLevel: 9,
      effort: 10,
      palette: false
    })
    .toBuffer();

  const before = await decodedRaw(original);
  const after = await decodedRaw(optimized);
  const pixelsMatch = samePixels(before, after);
  const savedBytes = original.byteLength - optimized.byteLength;
  const relativePath = path.relative(root, filePath);

  const result = {
    file: relativePath,
    beforeBytes: original.byteLength,
    afterBytes: optimized.byteLength,
    savedBytes,
    savedPct: Number(((savedBytes / original.byteLength) * 100).toFixed(1)),
    pixelsMatch,
    applied: false,
    skippedReason: ""
  };

  if (!pixelsMatch) {
    result.skippedReason = "pixel-mismatch";
    return result;
  }

  if (savedBytes <= 0) {
    result.skippedReason = "not-smaller";
    return result;
  }

  if (apply) {
    const backupPath = path.join(backupRoot, relativePath);
    await fs.mkdir(path.dirname(backupPath), { recursive: true });
    await fs.copyFile(filePath, backupPath);
    await fs.writeFile(filePath, optimized);
    result.applied = true;
  }

  return result;
}

const files = await listPngs(targetDir);
const results = [];

for (const file of files) {
  const result = await optimizeOne(file);
  if (result) results.push(result);
}

const applied = results.filter((item) => item.applied);
const optimizable = results.filter((item) => item.pixelsMatch && item.savedBytes > 0);
const totalSaved = (apply ? applied : optimizable).reduce((sum, item) => sum + item.savedBytes, 0);

for (const item of results) {
  const marker = item.applied ? "APPLIED" : item.skippedReason ? "SKIP" : "READY";
  console.log(
    [
      marker.padEnd(7),
      formatBytes(item.beforeBytes).padStart(9),
      "->",
      formatBytes(item.afterBytes).padStart(9),
      `${item.savedPct.toFixed(1)}%`.padStart(7),
      item.file,
      item.skippedReason
    ].filter(Boolean).join(" ")
  );
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "dry-run",
      checked: results.length,
      optimizable: optimizable.length,
      applied: applied.length,
      totalSavedBytes: totalSaved,
      totalSavedText: formatBytes(totalSaved),
      backupRoot: apply ? path.relative(root, backupRoot) : null
    },
    null,
    2
  )
);
