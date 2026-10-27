# 羽痕 iOS

羽痕是一个原生 SwiftUI 羽毛球装备记录 App。当前版本定位为**本地优先的个人工具**：数据、装备照片和分析结果保存在设备上，不依赖 Web 服务即可使用。

> 当前 iOS App 不包含账号登录、NextAuth、线上 API 或 Supabase 同步。仓库中的 Web 项目与 iOS App 是两套独立的数据运行时，不能自动保持一致。

## 当前状态

- 产品阶段：可试用的本地单机 Beta。
- App 版本：`0.1.0 (1)`。
- 技术栈：SwiftUI、Observation、Swift Charts、PhotosUI、Vision。
- 系统要求：iOS 17 或更高版本。
- 设备范围：iPhone 保持竖屏；iPad 支持全部四个方向，并支持分屏与窗口尺寸调整。
- 数据来源：设备本地 JSON；首次安装默认没有业务数据。

## 已实现功能

### 总览

- 累计投入、在用装备、闲置库存和心愿目标。
- 最近五条购买变化。

### 装备库与购买

- 按羽毛球、球拍、球鞋分类浏览和搜索内置装备目录。
- 使用目录预填品牌、型号、参考价格和本地装备图。
- 新增购买记录，记录单价、数量、日期、渠道、状态和备注。
- 自定义装备，以及羽毛球、球拍、球鞋的专属规格。
- 品牌可独立于目录型号选择；已有品牌下可手填新型号，切换分类、恢复草稿或再次购买时保留品牌。
- 从相册选择装备照片，在设备上生成主体抠图。羽毛球分类的纯色背景球桶图优先按完整外轮廓处理，保留桶身文字、深色区域及多桶间隙；不满足条件的照片使用 Vision 识别。

### 装备墙

- 根据购买记录自动归并装备档案。
- 卡片墙和洞洞板两种视图。洞洞板自动排列按球桶直边长度缩放、按直边下端对齐，保留上下弧度及原图比例；轮廓不明确时按原图尺寸回退。
- 分类、搜索、排序，以及在用/历史装备展示。
- 装备资料和购买记录编辑。
- 长按装备卡片，或打开装备详情的“更多”菜单，可选择“再买一次”；预填上次品牌、型号、单价和渠道，本次日期与数量重新确认。
- 保存成功后可直接查看装备，自动回到卡片墙并定位、高亮对应装备。
- 羽毛球剩余库存为 1 筒时，在卡片原有库存标签中提示，不新增行高；备用库存也计入剩余量。
- 自选照片处理期间显示进度，完成后淡入抠图结果，并支持切换原图与抠图预览。
- 支持从购买详情或购买记录编辑页删除单笔购买，确认后同步更新库存与支出；8 秒内可撤销并恢复照片、消耗和穿线记录，不覆盖期间新增或修改的其他记录。删除最后一笔时会明确提示同时移除装备档案。
- 购买记录支持分次记录用完数量、用完日期及可选启用日期，可撤销误记；购买数量与支出保持不变。
- 装备详情展示剩余库存、消耗历史、本月用完数量，以及有启用日期的每批使用天数。
- 旧的整批已用完记录保持兼容，未记录的用完日期不会自动补成今天。
- 球拍穿线记录的新增、编辑、删除和费用趋势。
- 删除装备时会明确提示相关购买记录也会被删除。

### 心愿与分析

- 从装备库直接加入心愿，并自动阻止重复收藏。
- 心愿的新增、编辑、状态管理、筛选、排序和删除。
- 心愿展示目标价、当前价和价格差，并可一键转为购买记录。
- 按全部历史或年份查看消费趋势。
- 品牌、分类、购买渠道、购买频率图表。点击图表或图例可查看对应购买记录、汇总数量与金额，并进入单笔详情；列表保留当前年份筛选。

### 设置与数据安全

- 浅色、深色、跟随系统三种显示模式。
- 多套 App 图标；更换成功后，按钮、选中状态和入手成功页的强调色同步更新，银色图标保留经典蓝。
- 导出和导入 `.btbackup` 备份，完整打包本地装备照片的原图、抠图与缩略图；恢复前预览记录数量并保存恢复点，缺失照片或不支持的备份版本不会覆盖当前记录。兼容旧 JSON 和目录式备份。
- 清空本地数据前需要二次确认。

## 卡片与图片规范

统一使用 `appSurface` 管理底色、连续圆角、裁切和边框，禁止分别叠加不同圆角的背景与描边：

- 常规内容与图表卡片：18 pt 圆角；紧凑数据卡片：16 pt；独立装备大图：22 pt。
- 独立容器统一使用系统分组次级背景和一物理像素的内描边；增强对比度时加深边框并使用 1 pt 线宽。
- 内部图片使用 12 pt 圆角和系统分组三级背景，不重复描边；同一卡片内的行内容继承父容器底色。
- 系统 List/Form 使用系统容器与分隔线；状态标签、错误提示及虚线占位继续使用各自的语义样式。
- 缩略图与详情图按不同尺寸在后台串行解码、裁剪并缓存，视图绘制期间只读取准备好的图片。
- 洞洞板按装备、模式、排序和窗口宽度复用已完成的布局，切换清单或底部标签时保留缓存；支出和分析统计仅在相关数据变化时重新计算。

## 数据与隐私

业务数据默认写入 App 的 Application Support 目录：

```text
BadmintonTracker/local-data.json
BadmintonTracker/GearPhotos/
```

装备照片会在设备上缩放和抠图，不会由 iOS App 上传到服务器。备份文件可能包含购买信息、心愿信息和经过 Base64 编码的本地照片，请像保护其他个人数据一样保管备份。

删除整件装备会同时删除与该装备关联的所有购买记录。清空本地数据会删除购买、装备墙、心愿和洞洞板布局；这些操作只能通过事先导出的备份恢复。

## 从 Web 数据迁移

iOS App 不会自动读取 Web 数据。需要时，可在仓库根目录生成一次性 iOS 备份：

```bash
npm run data:export-ios-backup -- --source=cloud --user-email=you@example.com
```

备份默认输出到 `output/ios-backups/`。将生成的 `.btbackup` 文件发送到设备，然后在“设置 → 导入备份包”中导入。

也可以从本地数据库导出：

```bash
npm run data:export-ios-backup -- --source=local --user-email=you@example.com
```

导出脚本会读取对应环境文件中的数据库连接。不要提交 `.env`、`.env.local` 或包含真实用户数据的备份文件。

## 打开与构建

使用 Xcode 打开：

```bash
open ios/BadmintonTracker/BadmintonTracker.xcodeproj
```

命令行构建示例：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild \
  -project ios/BadmintonTracker/BadmintonTracker.xcodeproj \
  -scheme BadmintonTracker \
  -configuration Debug \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

如果系统的 `xcode-select -p` 仍指向 `/Library/Developer/CommandLineTools`，直接运行 `xcodebuild` 或模拟器自动化会失败。开发机需要选择完整 Xcode，或者像上面的命令一样显式设置 `DEVELOPER_DIR`。

## 测试现状

`Tests/GearProfileDetailsTests.swift` 当前是一份独立的模型回归脚本，覆盖旧数据兼容、球拍规格、穿线历史、渠道归一化、洞洞板分类和图表坐标轴等逻辑。它尚未接入 XCTest target。

可以临时执行：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun swiftc \
  ios/BadmintonTracker/BadmintonTracker/Models/DomainModels.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/LocalGearCatalog.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/EquipmentModels.swift \
  ios/BadmintonTracker/Tests/GearProfileDetailsTests.swift \
  -o /tmp/badminton-tracker-model-tests

/tmp/badminton-tracker-model-tests
```

脚本成功时退出码为 `0`，默认不会输出内容。

球桶抠图回归测试（白底、黑底、多桶间隙、横放及低对比度回退）：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun swiftc \
  ios/BadmintonTracker/BadmintonTracker/Services/ShuttleTubeCutout.swift \
  ios/BadmintonTracker/Tests/ShuttleTubeCutoutTests.swift \
  -o /tmp/shuttle-tube-tests
/tmp/shuttle-tube-tests
```

可附加输入 JPG 路径和输出 PNG 路径，验证双桶样例并导出透明图。照片处理变更对重新选择的照片生效，不自动覆盖已保存的抠图。


## 已知限制与后续优先级

### 发布前应完成

1. 建立 XCTest target，把本地持久化、备份导入导出、照片引用迁移和核心数据计算纳入自动化测试。
2. 增加 iOS CI，至少覆盖 Debug 构建和单元测试。
3. 确认长期产品方向：保持本地单机版，或设计明确的账号与同步方案；在方案确定前不要重新引入浏览器 Cookie 登录。
4. 增加中文以外的本地化资源，并完成 VoiceOver、动态字体和 iPad 实机检查。

### 功能缺口

- 没有账号、跨设备同步、云备份和冲突解决。
- 没有相机拍摄、小票管理或 Apple Health 集成。
- 分析模型预留了装备排行，但当前本地计算与界面尚未实现。

### 工程维护

- `GearView.swift`、`PurchasesView.swift`、`LocalDataStore.swift` 和 `DomainModels.swift` 体积较大；继续增加功能前应按编辑器、详情、图表和持久化职责拆分。
- 演示数据仍保留在代码中，但当前正式界面没有演示模式入口。
- 仓库目前没有 iOS 专用 CI，也没有自动执行模型回归脚本。

### 球桶排列几何回归

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun swiftc \
  ios/BadmintonTracker/BadmintonTracker/Services/ShuttleTubeGeometry.swift \
  ios/BadmintonTracker/Tests/ShuttleTubeGeometryTests.swift \
  -o /tmp/shuttle-geometry-tests
/tmp/shuttle-geometry-tests
```

覆盖矩形与弧形端盖、透明留白、等比缩放、直边基线和不透明图片回退。
可附加素材目录及输出 PNG 路径，导出带直边参考线的排列预览：

```bash
/tmp/shuttle-geometry-tests public/gear-images/cutout /tmp/pegboard-side-alignment.png
```

### 分析图表下钻回归

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun swiftc \
  ios/BadmintonTracker/BadmintonTracker/Models/DomainModels.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/LocalGearCatalog.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/EquipmentModels.swift \
  ios/BadmintonTracker/Tests/AnalyticsDrilldownTests.swift \
  -o /tmp/analytics-drilldown-tests
/tmp/analytics-drilldown-tests
```

覆盖年份与月份、渠道别名、未记录分组、同一装备多次购买、金额核对、空月份及扇区边界。运行时还需检查图表点选、环形图中心空白、上下滚动和返回后再次点选。

### 球拍摆正回归

球拍优先按中杆直线确定摆正角度，无法可靠识别时回退到整图主轴。归并模型测试显式加载 `Seed/equipment_catalog.json`，避免独立命令行测试因缺少 App Bundle 资源而误报。

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun swiftc \
  ios/BadmintonTracker/BadmintonTracker/Services/RacketAxisGeometry.swift \
  ios/BadmintonTracker/Tests/RacketAxisGeometryTests.swift \
  -o /tmp/racket-axis-tests
/tmp/racket-axis-tests
```

可附加输入球拍图片和输出 PNG 路径，验证实际素材的中杆方向并导出旋转结果。

### 单品购买趋势

购买量和价格使用连续日期轴，共用时间范围。同一天的数量合计，单价按有有效价格的购买数量加权；无法解析日期的记录不进入趋势图。跨年标签包含年份。

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun swiftc \
  ios/BadmintonTracker/BadmintonTracker/Models/DomainModels.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/LocalGearCatalog.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/EquipmentModels.swift \
  ios/BadmintonTracker/Tests/PurchaseTrendTests.swift \
  -o /tmp/purchase-trend-tests
/tmp/purchase-trend-tests
```

### 分析数值查看

分析页的趋势、品类、渠道、频率和品牌环形图支持长按后拖动查看数值。提示显示完整金额（保留两位小数）或购买次数，松手及手势取消时消失；短按继续进入对应购买记录。环形图中心空白区域不触发选择。

### 装备显示与洞洞板排序

- 消耗入口统一为“记录消耗”。
- 装备名称优先使用目录标准名称（例如“弓箭 11 Pro”），购买记录与分析详情共用解析规则；历史购买快照不被覆盖，未匹配的自定义名称原样显示。
- 洞洞板支持默认、品牌、价格升降序、最近购买、最早购买排序，偏好保存在本机。品牌顺序为 YONEX、亚狮龙、VICTOR、李宁、其他品牌；各装备类别分区内排序。同款装备仍相邻排列。
- 显式选择排序时重新排列，切回默认可恢复已有布局，排序操作不删除已保存的位置。

显示与排序回归：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun swiftc \
  ios/BadmintonTracker/BadmintonTracker/Models/DomainModels.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/LocalGearCatalog.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/EquipmentModels.swift \
  ios/BadmintonTracker/Tests/GearPresentationTests.swift \
  -o /tmp/gear-presentation-tests
/tmp/gear-presentation-tests
```

### 穿线支出与分析明细

- `SpendingLedger` 合并购买记录与球拍穿线历史，按穿线记录 ID 去重。首页累计投入、分析本月花费、支出趋势、品牌/分类/渠道图表与下钻明细使用同一口径。
- 穿线费用归入「穿线」分类；品牌沿用所属装备品牌，渠道使用穿线记录渠道。球线型号归一化后独立统计穿线次数与费用。
- 未填写费用的穿线记录计入次数，金额不作估算；未填写有效日期的费用计入全部历史总额，但不进入时间趋势或具体年份。购买频率仍只统计购买记录。
- 点按图表打开对应记录列表，长按并移动查看数值；图例和型号列表也可打开明细。穿线条目显示对应球拍、型号、日期、费用及磅数。
- 状态与操作使用语义色，并保留文字：在用绿色、用完灰色、闲置橙色、退役紫色；记录消耗橙色、删除红色。

回归测试：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun swiftc \
  ios/BadmintonTracker/BadmintonTracker/Models/DomainModels.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/LocalGearCatalog.swift \
  ios/BadmintonTracker/BadmintonTracker/Models/EquipmentModels.swift \
  ios/BadmintonTracker/Tests/SpendingLedgerTests.swift \
  -o /tmp/spending-ledger-tests
/tmp/spending-ledger-tests
```

### 装备名称标准化

YONEX 球拍统一采用「中文系列名 + 型号」，例如「弓箭 11 Pro」「天斧 88D Pro」。目录加载与购买/装备展示共用 `GearDisplayName.canonicalName`，兼容 ASTROX/AX/天斧、ARCSABER/ARC/弓箭/弓等写法和大小写、空格差异。保留 Pro/Tour/Play/Game 等型号级别及括号内版本信息；品牌与品类不匹配时不套用规则。内置目录版本升级为 4，更新已有安装的目录名称，历史购买原始数据不改写。搜索仍支持英文系列名称。

VICTOR 的 DriveX 12 / DX-12 / 驭12 统一显示为「驭 12」，ZSW J 版显示为「驭 12 (ZSW J)」。支持 VICTOR、胜利、威克多品牌别名及英文搜索；名称匹配优先精确结果，避免联名版落到普通版。
