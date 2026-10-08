# 装备名称与别名库

从现有 iOS 内置目录整理了 10 个品牌、43 件装备，保留原有 UUID、型号、图片、价格、标签和版本字段。以后在这里维护名称与别名，无需重新整理现有装备。

## 文件位置

- `brands.json`：品牌标准名称与别名。
- `equipment/yonex.json`：YONEX 装备，例如弓箭 11 Pro、天斧 88D Pro。
- `equipment/victor.json`：VICTOR 装备，例如驭 12、驭 12 (ZSW J)。
- `equipment/lining.json`：李宁装备。
- `equipment/rsl.json`：亚狮龙装备。
- 其他品牌各自放在 `equipment/` 下的同名文件中。
- `manifest.json`：文件结构版本与目录版本；`source` 记录初始化数据来源。

## 日常维护

1. 找到品牌文件，在 `equipment` 数组中找到型号。
2. 修改 `name` 设置标准显示名称；旧名称加入 `aliases`。
3. 补充简称或英文写法时，修改 `aliases`。标准名称、`nameEn` 和 `model` 本身已经是匹配候选，不必重复填写。
4. 修改条目后递增 `revision`，更新 `updatedAt`；发布新目录时递增 `manifest.json` 的 `catalogVersion`。
5. 在项目根目录执行：

```bash
python3 scripts/validate-catalog.py
```

校验会检查 JSON 格式、UUID、重复 ID、品牌引用、品类、价格以及同品牌同品类的名称/型号/别名冲突。

## 字段说明

| 字段 | 含义与维护规则 |
| --- | --- |
| `id` | 永久 ID，已有条目不要改；新增装备使用新的 UUID |
| `brandId` | 引用 `brands.json` 的品牌 ID，必须与所属文件一致 |
| `name` | 标准显示名称，沿用当前项目的字符串结构 |
| `nameEn` | 英文名称；不确定时填 `null`，不要猜测 |
| `model` | 型号代码，沿用原目录字段名，例如 `DX-12` |
| `aliases` | 常见旧名称、简称和其他明确指向该型号的叫法 |
| `category` | 当前支持：球拍、羽毛球、球鞋、其他 |
| `series` | 系列信息；未知时保留 `null` |
| `variant` / `generation` / `color` | 版本、代际、颜色；未知不等于所有版本通用 |
| `weightClass` / `gripSize` | 重量与握柄规格，保持现有字段 |
| `imageKey` | 图片资源键，改名时不要连带修改 |
| `suggestedUnitPriceCny` | 参考价格，不是用户实际购买价格 |
| `isActive` | 不再推荐时设为 `false`，不要删除有历史关联的条目 |
| `revision` / `updatedAt` | 条目版本与更新时间 |

这里为了兼容原项目，使用 `name` + `nameEn`，而不是示例中的嵌套 `name.zh` / `name.en`。品牌 RSL 也保留原系统标准值，中文“亚狮龙”列为品牌别名。

## 新增装备

复制同品牌的一条记录，生成新 UUID，然后修改名称、型号、别名、图片等信息；删除不适用的别名。不要复制旧 ID。

```bash
python3 -c 'import uuid; print(uuid.uuid4())'
```

新增品牌时，先在 `brands.json` 新增品牌，再创建对应的 `equipment/<brandId>.json`。文件格式参考已有品牌文件。

## 匹配与版本规则

- 大小写、空格、全半角、连字符差异由归一化处理，无需穷举。
- 名称与别名只能在对应品牌、品类内匹配。
- “驭12”归普通版；“驭12 ZSW J”归 ZSW J 版，两者保留不同 UUID。
- 新代际、联名版或需要独立统计的颜色版本建立独立条目；不要把它们全加到普通版别名中。
- 不明确的叫法不添加为精确别名，模糊搜索应只提供候选。
- 当前已填写弓箭、天斧、驭 12 的常用别名；其他型号的别名可继续补充，空数组表示尚未整理。

## 与应用的关系

本目录当前是维护库，校验命令只读取文件，不改写应用数据。iOS 仍读取 `ios/BadmintonTracker/BadmintonTracker/Resources/Seed/equipment_catalog.json`，Web 仍沿用原有目录；修改本目录不会立即改变应用显示。

后续接入时应从这里生成应用目录，并把 `aliases` 接入精确匹配和搜索，保留所有现有 UUID。不能仅复制 JSON 到应用就假定别名已经生效。接入生成流程后，应只维护本目录，避免双份手工维护。
