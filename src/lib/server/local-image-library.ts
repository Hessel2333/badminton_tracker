import fs from "node:fs/promises";
import path from "node:path";

type LocalImageQuery = {
  name: string;
  brandName?: string | null;
  modelCode?: string | null;
};

const PUBLIC_DIR_NAME = "gear-images";
const PUBLIC_DIR = path.join(process.cwd(), "public", PUBLIC_DIR_NAME);

const RAW_EXACT_NAME_MAP: Record<string, string> = {
  "亚狮龙1号": "cutout/rsl_shuttlecock_no1_cutout_01.png",
  "亚狮龙2号": "cutout/rsl_shuttlecock_no2_cutout_01.png",
  "亚狮龙3号": "cutout/rsl_shuttlecock_no3_cutout_01.png",
  "亚狮龙4号": "cutout/rsl_shuttlecock_no4_cutout_01.png",
  "亚狮龙5号": "cutout/rsl_shuttlecock_no5_cutout_01.png",
  "亚狮龙6号": "cutout/rsl_shuttlecock_no6_cutout_01.png",
  "亚狮龙7号": "cutout/rsl_shuttlecock_no7_cutout_01.png",
  "亚狮龙8号": "cutout/rsl_shuttlecock_no8_cutout_01.png",
  "亚狮龙10号": "cutout/rsl_shuttlecock_no10_cutout_01.png",
  "亚狮龙Classic": "cutout/rsl_shuttlecock_classic_cutout_01.png",
  "亚狮龙Supreme": "cutout/rsl_shuttlecock_supreme_cutout_01.png",
  "亚狮龙Ultimate": "cutout/rsl_shuttlecock_ultimate_cutout_01.png",
  "亚狮龙经典": "cutout/rsl_shuttlecock_classic_cutout_01.png",
  "亚狮龙至尊": "cutout/rsl_shuttlecock_supreme_cutout_01.png",
  "亚狮龙终极": "cutout/rsl_shuttlecock_ultimate_cutout_01.png",
  "黄超羽毛球": "cutout/chao_shuttlecock_huangchao_cutout_01.png",
  "黄超": "cutout/chao_shuttlecock_huangchao_cutout_01.png",
  "橙超": "cutout/chao_shuttlecock_chengchao_cutout_01.png",
  "橙超羽毛球": "cutout/chao_shuttlecock_chengchao_cutout_01.png",
  "粉超": "cutout/chao_shuttlecock_fenchao_cutout_01.png",
  "粉超羽毛球": "cutout/chao_shuttlecock_fenchao_cutout_01.png",
  "红超": "cutout/chao_shuttlecock_hongchao_cutout_01.png",
  "红超羽毛球": "cutout/chao_shuttlecock_hongchao_cutout_01.png",
  "金红超": "cutout/chao_shuttlecock_jinhongchao_cutout_01.png",
  "金红超羽毛球": "cutout/chao_shuttlecock_jinhongchao_cutout_01.png",
  "蓝超": "cutout/chao_shuttlecock_lanchao_cutout_01.png",
  "蓝超羽毛球": "cutout/chao_shuttlecock_lanchao_cutout_01.png",
  "绿超": "cutout/chao_shuttlecock_lvchao_cutout_01.png",
  "绿超羽毛球": "cutout/chao_shuttlecock_lvchao_cutout_01.png",
  "银超": "cutout/chao_shuttlecock_yinchao_cutout_01.png",
  "银超羽毛球": "cutout/chao_shuttlecock_yinchao_cutout_01.png",
  "紫超": "cutout/chao_shuttlecock_zichao_cutout_01.png",
  "紫超羽毛球": "cutout/chao_shuttlecock_zichao_cutout_01.png",
  "翎美F6": "cutout/lingmei_shuttlecock_f6_cutout_01.png",
  "翎美 F6": "cutout/lingmei_shuttlecock_f6_cutout_01.png",
  "翎美L06": "cutout/lingmei_shuttlecock_l06_cutout_01.png",
  "翎美 L06": "cutout/lingmei_shuttlecock_l06_cutout_01.png",
  "精彩永恒G6": "cutout/jingcaiyongheng_shuttlecock_g6_cutout_01.png",
  "精彩永恒 G6": "cutout/jingcaiyongheng_shuttlecock_g6_cutout_01.png",
  "精彩永恒G6羽毛球": "cutout/jingcaiyongheng_shuttlecock_g6_cutout_01.png",
  "精彩永恒 G6 羽毛球": "cutout/jingcaiyongheng_shuttlecock_g6_cutout_01.png",
  "金威肯": "cutout/weiken_shuttlecock_jinweiken_cutout_01.png",
  "金威肯羽毛球": "cutout/weiken_shuttlecock_jinweiken_cutout_01.png",
  "黄威肯": "cutout/weiken_shuttlecock_huangweiken_cutout_01.png",
  "黄威肯羽毛球": "cutout/weiken_shuttlecock_huangweiken_cutout_01.png",
  "红威肯": "cutout/weiken_shuttlecock_hongweiken_cutout_01.png",
  "红威肯羽毛球": "cutout/weiken_shuttlecock_hongweiken_cutout_01.png",
  "绿威肯": "cutout/weiken_shuttlecock_lvweiken_cutout_01.png",
  "绿威肯羽毛球": "cutout/weiken_shuttlecock_lvweiken_cutout_01.png",
  "蓝威肯": "cutout/weiken_shuttlecock_lanweiken_cutout_01.png",
  "蓝威肯羽毛球": "cutout/weiken_shuttlecock_lanweiken_cutout_01.png",
  "黑威肯": "cutout/weiken_shuttlecock_heiweiken_cutout_01.png",
  "黑威肯羽毛球": "cutout/weiken_shuttlecock_heiweiken_cutout_01.png",
  "YONEX AS-50": "cutout/yonex_shuttlecock_as50_cutout_01.png",
  "Yonex AS-50": "cutout/yonex_shuttlecock_as50_cutout_01.png",
  "AS-50": "cutout/yonex_shuttlecock_as50_cutout_01.png",
  "P8500NL": "cutout/victor_shoes_p8500nl_cutout_01.png",
  "P9200TTY": "cutout/victor_shoes_p9200tty_cutout_01.png",
  "贴地飞行 2 MAX": "cutout/lining_shoes_tiedifeixing2max_cutout_01.png",
  "VICTOR 大铁锤": "cutout/victor_racket_thruster_hammer_cutout_01.png"
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[_\-（）()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactNormalize(value: string) {
  return normalize(value).replace(/\s+/g, "");
}

const EXACT_NAME_MAP = Object.fromEntries(
  Object.entries(RAW_EXACT_NAME_MAP).map(([key, value]) => [compactNormalize(key), value])
) as Record<string, string>;

function tokenize(value: string) {
  return normalize(value)
    .split(" ")
    .filter((item) => item.length >= 2);
}

function withBrandAliases(tokens: string[]) {
  const out = [...tokens];
  if (tokens.some((item) => item.includes("亚狮龙") || item === "rsl")) {
    out.push("rsl");
  }
  if (tokens.some((item) => item.includes("胜利") || item.includes("victor"))) {
    out.push("victor");
  }
  if (tokens.some((item) => item.includes("李宁") || item.includes("lining") || item.includes("li-ning"))) {
    out.push("li", "ning");
  }
  return [...new Set(out)];
}

type GearCategory = "shuttlecock" | "shoes" | "racket" | null;

function inferCategory(seed: string): GearCategory {
  const text = normalize(seed);
  if (
    /羽毛球|shuttle|亚狮龙|rsl|no\\s*\\d+|[红黄蓝绿紫粉橙银]超|金红超|chao|lingmei|翎美|weiken|威肯|精彩永恒|jingcaiyongheng|yonex|as\\s*50/.test(text)
  ) {
    return "shuttlecock";
  }
  if (/球鞋|shoes|p\\d{4}|max|tty|nl/.test(text)) {
    return "shoes";
  }
  if (/球拍|racket|铁锤/.test(text)) {
    return "racket";
  }
  return null;
}

function inferCategoryFromFilename(file: string): GearCategory {
  const text = normalize(path.parse(file).name);
  if (text.includes("shuttlecock")) return "shuttlecock";
  if (text.includes("shoes")) return "shoes";
  if (text.includes("racket")) return "racket";
  return null;
}

async function listLocalImageFiles() {
  async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const output: string[] = [];

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const child = await walk(full);
        output.push(...child);
        continue;
      }
      if (!/\.(jpg|jpeg|png|webp|avif)$/i.test(entry.name)) continue;
      output.push(path.relative(PUBLIC_DIR, full));
    }

    return output;
  }

  try {
    return await walk(PUBLIC_DIR);
  } catch {
    return [];
  }
}

export async function findLocalImageUrl(query: LocalImageQuery): Promise<string | null> {
  const exact = EXACT_NAME_MAP[compactNormalize(query.name)];
  if (exact) {
    return `/${PUBLIC_DIR_NAME}/${exact}`;
  }

  const files = await listLocalImageFiles();
  if (!files.length) return null;

  const seed = [query.brandName ?? "", query.modelCode ?? "", query.name].join(" ");
  const tokens = withBrandAliases(tokenize(seed));
  const expectedCategory = inferCategory(seed);

  if (!tokens.length) return null;

  let bestFile: string | null = null;
  let bestScore = 0;

  for (const file of files) {
    const fileCategory = inferCategoryFromFilename(file);
    if (expectedCategory && fileCategory && expectedCategory !== fileCategory) {
      continue;
    }

    const base = normalize(path.parse(file).name);
    let score = 0;

    for (const token of tokens) {
      if (base.includes(token)) {
        score += token.length >= 5 ? 3 : 1;
      }
    }

    if (file.includes("cutout/")) {
      score += 2;
    }
    if (/\.png$/i.test(file)) {
      score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestFile = file;
    }
  }

  if (!bestFile || bestScore <= 0) return null;
  return `/${PUBLIC_DIR_NAME}/${bestFile}`;
}
