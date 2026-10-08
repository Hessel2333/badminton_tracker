import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const sourcePath = path.resolve(
  process.cwd(),
  "ios/BadmintonTracker/IconSources/default-blue-source.png"
);
const assetsRoot = path.resolve(
  process.cwd(),
  "ios/BadmintonTracker/BadmintonTracker/Assets.xcassets"
);

const icons = [
  {
    appSet: "AppIcon",
    previewSet: "IconPreviewBlue",
    file: "app-icon-blue.png",
    name: "Blue",
    color: "#0A84FF",
  },
  {
    appSet: "AppIconGreen",
    previewSet: "IconPreviewGreen",
    file: "app-icon-green.png",
    name: "Green",
    color: "#00A84F",
  },
  {
    appSet: "AppIconVictorBlue",
    previewSet: "IconPreviewVictorBlue",
    file: "app-icon-victor-blue.png",
    name: "Victor",
    color: "#0E2F90",
  },
  {
    appSet: "AppIconRed",
    previewSet: "IconPreviewRed",
    file: "app-icon-red.png",
    name: "Red",
    color: "#E42D36",
  },
  {
    appSet: "AppIconSilver",
    previewSet: "IconPreviewSilver",
    file: "app-icon-silver.png",
    name: "Silver",
    color: "#52525B",
  },
  {
    appSet: "AppIconOrange",
    previewSet: "IconPreviewOrange",
    file: "app-icon-orange.png",
    name: "Orange",
    color: "#F97316",
  },
  {
    appSet: "AppIconPurple",
    previewSet: "IconPreviewPurple",
    file: "app-icon-purple.png",
    name: "Purple",
    color: "#8B5CF6",
  },
  {
    appSet: "AppIconAqua",
    previewSet: "IconPreviewAqua",
    file: "app-icon-aqua.png",
    name: "Aqua",
    color: "#2DCCC7",
  },
];

function appIconContents(file) {
  return {
    images: [{ filename: file, idiom: "universal", platform: "ios", size: "1024x1024" }],
    info: { author: "xcode", version: 1 },
  };
}

function imageSetContents(file) {
  return {
    images: [{ filename: file, idiom: "universal", scale: "1x" }],
    info: { author: "xcode", version: 1 },
  };
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function featherMaskWeight(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const blueDominance = b - Math.max(r, g);

  if (b < 116 || saturation < 34 || blueDominance < 16) return 0;

  const dominanceWeight = Math.min(1, Math.max(0, (blueDominance - 16) / 84));
  const saturationWeight = Math.min(1, Math.max(0, (saturation - 34) / 120));
  return Math.max(dominanceWeight, saturationWeight * 0.92);
}

function recolorPixel(r, g, b, target) {
  const brightness = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  const shade = 0.34 + brightness * 0.82;
  const lift = Math.max(0, brightness - 0.72) * 0.34;

  const nr = Math.round(Math.min(255, target.r * shade + 255 * lift));
  const ng = Math.round(Math.min(255, target.g * shade + 255 * lift));
  const nb = Math.round(Math.min(255, target.b * shade + 255 * lift));
  return [nr, ng, nb];
}

async function buildIcon(color) {
  const target = hexToRgb(color);
  const { data, info } = await sharp(sourcePath)
    .resize(1024, 1024, { fit: "cover", position: "center" })
    .flatten({ background: "#f4f5f5" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const output = Buffer.from(data);
  for (let i = 0; i < output.length; i += info.channels) {
    const r = output[i];
    const g = output[i + 1];
    const b = output[i + 2];
    const weight = featherMaskWeight(r, g, b);
    if (weight === 0) continue;

    const [nr, ng, nb] = recolorPixel(r, g, b, target);
    output[i] = Math.round(r * (1 - weight) + nr * weight);
    output[i + 1] = Math.round(g * (1 - weight) + ng * weight);
    output[i + 2] = Math.round(b * (1 - weight) + nb * weight);
  }

  return sharp(output, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function writeAsset(setName, extension, file, contents, buffer) {
  const dir = path.join(assetsRoot, `${setName}.${extension}`);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, file), buffer);
  await fs.promises.writeFile(path.join(dir, "Contents.json"), `${JSON.stringify(contents(file), null, 2)}\n`);
}

await fs.promises.mkdir(assetsRoot, { recursive: true });
await fs.promises.writeFile(
  path.join(assetsRoot, "Contents.json"),
  `${JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2)}\n`
);

for (const icon of icons) {
  const buffer = icon.appSet === "AppIcon"
    ? await sharp(sourcePath)
      .resize(1024, 1024, { fit: "cover", position: "center" })
      .flatten({ background: "#f4f5f5" })
      .removeAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer()
    : await buildIcon(icon.color);

  await writeAsset(icon.appSet, "appiconset", icon.file, appIconContents, buffer);
  await writeAsset(icon.previewSet, "imageset", icon.file, imageSetContents, buffer);
  console.log(`${icon.name}: ${icon.file}`);
}

console.log("Generated aligned icon variants from default-blue-source.png.");
