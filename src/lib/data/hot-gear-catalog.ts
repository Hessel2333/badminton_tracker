export type HotGearSeed = {
  name: string;
  brandName: string;
  modelCode?: string;
  categoryName: string;
  suggestedUnitPriceCny?: number;
  popularity: number;
  imageUrl?: string;
  tags?: string[];
};

export const HOT_GEAR_CATALOG: HotGearSeed[] = [
  // Shuttlecocks
  { name: "亚狮龙 1号", brandName: "RSL", modelCode: "No.1", categoryName: "羽毛球", suggestedUnitPriceCny: 145, popularity: 98, imageUrl: "/gear-images/cutout/rsl_shuttlecock_no1_cutout_01.png", tags: ["比赛", "耐打"] },
  { name: "亚狮龙 2号", brandName: "RSL", modelCode: "No.2", categoryName: "羽毛球", suggestedUnitPriceCny: 130, popularity: 92, imageUrl: "/gear-images/cutout/rsl_shuttlecock_no2_cutout_01.png", tags: ["训练", "耐打"] },
  { name: "亚狮龙 7号", brandName: "RSL", modelCode: "No.7", categoryName: "羽毛球", suggestedUnitPriceCny: 105, popularity: 95, imageUrl: "/gear-images/cutout/rsl_shuttlecock_no7_cutout_01.png", tags: ["训练", "口粮球"] },
  { name: "YONEX AS-50", brandName: "YONEX", modelCode: "AS-50", categoryName: "羽毛球", suggestedUnitPriceCny: 220, popularity: 80, imageUrl: "/gear-images/cutout/yonex_shuttlecock_as50_cutout_01.png", tags: ["高端", "比赛"] },
  { name: "黄超羽毛球", brandName: "超牌", modelCode: "黄超", categoryName: "羽毛球", suggestedUnitPriceCny: 95, popularity: 88, imageUrl: "/gear-images/cutout/chao_shuttlecock_huangchao_cutout_01.png", tags: ["训练"] },

  // Shoes
  { name: "P9200TTY", brandName: "VICTOR", modelCode: "P9200TTY", categoryName: "球鞋", suggestedUnitPriceCny: 639, popularity: 90, imageUrl: "/gear-images/cutout/victor_shoes_p9200tty_cutout_01.png", tags: ["稳定", "比赛"] },
  { name: "P8500NL", brandName: "VICTOR", modelCode: "P8500NL", categoryName: "球鞋", suggestedUnitPriceCny: 439, popularity: 85, imageUrl: "/gear-images/cutout/victor_shoes_p8500nl_cutout_01.png", tags: ["训练", "缓震"] },
  { name: "贴地飞行 2 MAX", brandName: "李宁", modelCode: "贴地飞行2 MAX", categoryName: "球鞋", suggestedUnitPriceCny: 699, popularity: 92, imageUrl: "/gear-images/cutout/lining_shoes_tiedifeixing2max_cutout_01.png", tags: ["包裹", "启动"] },
  { name: "SHB 65Z3", brandName: "YONEX", modelCode: "SHB-65Z3", categoryName: "球鞋", suggestedUnitPriceCny: 699, popularity: 86, tags: ["经典", "综合"] },
  { name: "65Z C-90", brandName: "Mizuno", modelCode: "65Z C-90", categoryName: "球鞋", suggestedUnitPriceCny: 699, popularity: 78, tags: ["轻量", "抓地"] },

  // Rackets
  { name: "VICTOR 大铁锤", brandName: "VICTOR", modelCode: "TK-HMR", categoryName: "球拍", suggestedUnitPriceCny: 799, popularity: 84, imageUrl: "/gear-images/cutout/victor_racket_thruster_hammer_cutout_01.png", tags: ["重杀", "进攻"] },
  { name: "ASTROX 100ZZ", brandName: "YONEX", modelCode: "AX100ZZ", categoryName: "球拍", suggestedUnitPriceCny: 1680, popularity: 95, tags: ["头重", "进攻"] },
  { name: "ASTROX 88D PRO", brandName: "YONEX", modelCode: "AX88D PRO", categoryName: "球拍", suggestedUnitPriceCny: 1599, popularity: 90, tags: ["双打后场"] },
  { name: "NANOFLARE 1000Z", brandName: "YONEX", modelCode: "NF1000Z", categoryName: "球拍", suggestedUnitPriceCny: 1690, popularity: 85, tags: ["速度", "平抽"] },
  { name: "风刃 900", brandName: "李宁", modelCode: "Windstorm 900", categoryName: "球拍", suggestedUnitPriceCny: 1099, popularity: 79, tags: ["轻量", "控速"] },
  { name: "雷霆 90 龙", brandName: "李宁", modelCode: "3D Calibar 900", categoryName: "球拍", suggestedUnitPriceCny: 1299, popularity: 76, tags: ["进攻"] },
  { name: "TK-F C", brandName: "VICTOR", modelCode: "TK-F C", categoryName: "球拍", suggestedUnitPriceCny: 1390, popularity: 82, tags: ["爆发", "进攻"] },
  { name: "AURASPEED 90K II", brandName: "VICTOR", modelCode: "ARS-90K II", categoryName: "球拍", suggestedUnitPriceCny: 1380, popularity: 81, tags: ["速度", "双打"] }
];

