# 性能修复清单

基于当前仓库实现，页面切换卡顿和图片加载慢的主要原因不是 `Vercel + Supabase` 本身，而是前端图片策略、页面数据获取方式和部分重交互页面的实现成本过高。

## P0: 先解决最值钱的问题

### 1. 恢复图片优化链路

- [ ] 移除 [next.config.ts](./next.config.ts) 中的 `images.unoptimized: true`
- [ ] 为外部图片源补齐 `images.remotePatterns` 或等效白名单配置
- [ ] 逐步把关键页面里的原生 `<img>` 替换成 `next/image`
- [ ] 为图片补齐明确的 `sizes`
- [ ] 只给首屏关键图片设置高优先级，其他保持懒加载

重点文件：

- [next.config.ts](./next.config.ts)
- [src/components/forms/GearWallManager.tsx](./src/components/forms/GearWallManager.tsx)
- [src/components/forms/PurchaseManager.tsx](./src/components/forms/PurchaseManager.tsx)
- [src/components/forms/GearDetailEditor.tsx](./src/components/forms/GearDetailEditor.tsx)
- [src/app/(protected)/dashboard/page.tsx](./src/app/(protected)/dashboard/page.tsx)

预期收益：

- 降低图片体积
- 提高缓存命中率
- 减少切页后图片解码阻塞

### 2. 控制上传图片尺寸

- [ ] 检查上传入口，避免把手机原图直接作为列表页展示图
- [ ] 上传时生成缩略图或限制最长边
- [ ] 列表页、卡片页、详情页区分图片规格，不复用同一张原图

重点文件：

- [src/app/api/upload/route.ts](./src/app/api/upload/route.ts)
- [src/app/api/purchases/route.ts](./src/app/api/purchases/route.ts)
- [src/app/api/gear/route.ts](./src/app/api/gear/route.ts)

## P1: 缩短页面切换等待

### 3. 后台页改为服务端预取首屏数据

- [ ] 不要让后台核心页进入后才由客户端 `useSWR` 发第一轮请求
- [ ] 在页面层先查首屏数据，再通过 `fallbackData` 传给客户端组件
- [ ] 优先改造购买页、心愿单、设置页

重点文件：

- [src/app/(protected)/purchases/page.tsx](./src/app/(protected)/purchases/page.tsx)
- [src/app/(protected)/wishlist/page.tsx](./src/app/(protected)/wishlist/page.tsx)
- [src/app/(protected)/settings/page.tsx](./src/app/(protected)/settings/page.tsx)
- [src/components/forms/PurchaseManager.tsx](./src/components/forms/PurchaseManager.tsx)
- [src/components/forms/WishlistManager.tsx](./src/components/forms/WishlistManager.tsx)
- [src/components/forms/SettingsManager.tsx](./src/components/forms/SettingsManager.tsx)

预期收益：

- 路由切换后更快看到可交互内容
- 减少“壳子先出来，数据再补”的体感延迟

### 4. 补齐统一的 `loading.tsx`

- [ ] 为还没有加载态的受保护页面补 `loading.tsx`
- [ ] 加载态尽量贴近真实布局，避免页面闪烁

重点文件：

- [src/app/(protected)/settings/page.tsx](./src/app/(protected)/settings/page.tsx)
- [src/app/(protected)/gear-wall/page.tsx](./src/app/(protected)/gear-wall/page.tsx)
- [src/app/(protected)/gear-board/page.tsx](./src/app/(protected)/gear-board/page.tsx)

## P2: 降低接口和数据量压力

### 5. 收紧默认请求规模

- [ ] 把购买页默认 `pageSize=200` 降到更合理的首屏值
- [ ] 把项目库默认 `limit=2000` 明显下调
- [ ] 搜索类请求增加输入防抖
- [ ] 大列表改分页或“加载更多”，不要一次拉全量

重点文件：

- [src/components/forms/PurchaseManager.tsx](./src/components/forms/PurchaseManager.tsx)
- [src/app/api/purchases/route.ts](./src/app/api/purchases/route.ts)
- [src/app/api/catalog/route.ts](./src/app/api/catalog/route.ts)
- [src/app/api/settings/project-catalog/route.ts](./src/app/api/settings/project-catalog/route.ts)

### 6. 避免重复拉取低频变化数据

- [ ] 品类、品牌、评分维度这类低频数据优先做服务端预取或更长缓存
- [ ] 检查是否存在同页多个组件重复请求同一接口

重点文件：

- [src/components/forms/SettingsManager.tsx](./src/components/forms/SettingsManager.tsx)
- [src/components/forms/WishlistManager.tsx](./src/components/forms/WishlistManager.tsx)
- [src/components/forms/PurchaseManager.tsx](./src/components/forms/PurchaseManager.tsx)

## P3: 专门治理重页面

### 7. `gear-board` 不要一进入就全量处理图片

- [ ] 把图片尺寸测量从“全量预处理”改成“按需处理”
- [ ] 球拍图的旋转/裁剪规范化不要在进入页面时批量执行
- [ ] 优先只处理当前视口内或用户实际操作到的图片
- [ ] 评估是否把规范化结果持久化，避免每次重算

重点文件：

- [src/components/forms/GearPegboardManager.tsx](./src/components/forms/GearPegboardManager.tsx)
- [src/components/forms/ArchiveWorkspace.tsx](./src/components/forms/ArchiveWorkspace.tsx)

### 8. 审查 `dynamic(..., { ssr: false })` 的使用

- [ ] 只对确实依赖浏览器 API 的模块关闭 SSR
- [ ] 能服务端首屏渲染的部分尽量不要全量丢给客户端

重点文件：

- [src/components/forms/ArchiveWorkspace.tsx](./src/components/forms/ArchiveWorkspace.tsx)

## P4: 部署与外部服务检查

### 9. 校验区域一致性

- [ ] 确认 `Vercel` 部署区域与 `Supabase` 数据库区域尽量一致
- [ ] 检查 `Vercel Blob` 或外部图片源的访问延迟
- [ ] 区分“页面慢”与“首张图慢”，分别测量

### 10. 打开真实性能观测

- [ ] 用浏览器 Network 面板确认最大资源是谁
- [ ] 记录切换到 `purchases`、`gear-wall`、`gear-board` 的耗时
- [ ] 区分 TTFB、HTML 到达、接口耗时、图片下载、图片解码

## 建议执行顺序

1. 图片优化配置与 `<img>` 治理
2. 上传图尺寸治理
3. 购买页 / 心愿单 / 设置页首屏服务端预取
4. 收紧默认请求量
5. `gear-board` 的图片预处理按需化
6. 部署区域与真实性能观测复核

## 验收标准

- [ ] 切到非重页面时，不应明显看到长时间骨架屏
- [ ] 切到图片列表页时，首屏图片应快速出现，且不再明显逐张卡顿
- [ ] `gear-board` 首次进入时间显著下降
- [ ] 同一页面二次进入时，应有可感知的缓存收益
- [ ] 浏览器 Network 中不再出现大量超大原图直传直显
