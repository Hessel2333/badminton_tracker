# 图片导入记录

`2026-10-08-downloads.json` 记录本次 10 张图片的来源文件名、装备 UUID、图片键、透明 PNG 和旋转角度。

本次新增 8 件装备，补充已有天斧 100ZZ、AS-05 的图片，目录共 51 件。iOS Seed、图片清单、Web 项目目录及维护库已经同步更新。绿版 99 Pro 与白虎版分开建档，不根据文件名中的 `-2` 推断代际；未知价格、货号和代际不填。

原图保存在 `assets/gear_image/original/`，透明图保存在 `assets/gear_image/cutout/`，并复制到 Web public 与 iOS GearImages 资源中。原图不会被抠图覆盖。

重新处理本批图片（需要 macOS/Xcode、Python Pillow 和 NumPy）：

```bash
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcrun swiftc \
  ios/BadmintonTracker/BadmintonTracker/Services/RacketAxisGeometry.swift \
  ios/BadmintonTracker/BadmintonTracker/Services/ShuttleTubeCutout.swift \
  scripts/gear-import-geometry.swift -o /tmp/gear-import-geometry
python3 scripts/process-imported-gear.py --geometry /tmp/gear-import-geometry
python3 scripts/validate-catalog.py
```

处理复用现有球拍轴线与球桶识别算法。浅色背景按现有阈值去除，并保留中杆/握柄内的白色区域；球桶识别拒绝时按实体桶身的逐行边缘保留内部印刷。此回退针对本批商品图，不作为任意用户照片的通用处理保证。脚本处理后须检查 `output/gear-import-2026-10-08/preview.jpg`。
