# Badminton Cyber Tracker

羽毛球投入追踪网站 MVP（Web 优先，App 扩展预留）。

## 已实现能力

- 单账号登录（NextAuth Credentials）
- 购买记录 CRUD + CSV 导入导出
- 购买记录状态管理（在用/用完/穿坏或损坏/闲置）
- 赛博装备墙 + 装备详情（站内评分、外网评价引用）
- 装备本地图库优先匹配（新增装备时自动优先命中 `public/gear-images/cutout`，找不到再用原图）
- 心愿单（目标价、优先级、状态流转、转购买）
- 综合分析（投入趋势、品牌占比、品类占比、购买频率、心愿转化漏斗、评分排行）
- 设置页（品类管理、品牌归一化展示、JSON 备份导出）
- 图片上传（Vercel Blob）+ 外链 URL 双通道

## 技术栈

- Next.js (App Router) + TypeScript
- Tailwind CSS + 自定义赛博主题 Token
- Prisma + PostgreSQL
- NextAuth
- ECharts
- Vercel Blob
- Vitest

## 启动步骤

1. 复制环境变量：

```bash
cp .env.example .env
```

如果你要本地开发提速（推荐），再准备本地覆盖文件：

```bash
cp .env.local.example .env.local
```

2. 安装依赖：

```bash
npm install
```

3. 生成 Prisma Client + 迁移 + 种子数据：

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

若使用本地数据库覆盖（`.env.local`），使用：

```bash
npm run db:generate:local
npm run db:migrate:local
npm run db:seed:local
```

4. 启动开发环境：

```bash
npm run dev
```

5. （可选）同步本地图片并导入首批示例数据（包含你给的装备与用量状态）：

```bash
npm run data:import-initial
```

6. （可选）把 Supabase 线上数据同步到本地数据库：

```bash
npm run data:sync-supabase-to-local
```

访问 [http://localhost:3000](http://localhost:3000)。

## Supabase 连接建议

- `DATABASE_URL`：使用 Supabase Pooler（6543，带 `pgbouncer=true`），用于应用运行时。
- `DIRECT_URL`：使用 `db.<project-ref>.supabase.co:5432` 直连主库，用于 Prisma migrate/pull。

示例：

```env
DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.<project-ref>:<password>@db.<project-ref>.supabase.co:5432/postgres"
```

## 默认账号

由 `.env` 中的 `ADMIN_USERNAME` 与 `ADMIN_PASSWORD` 控制（`ADMIN_EMAIL` 仍可作为兼容回退）。

## 核心接口

- `POST/GET /api/purchases`
- `PUT/DELETE /api/purchases/:id`
- `POST /api/purchases/import`
- `GET /api/purchases/export`
- `POST/GET /api/gear`
- `GET /api/gear/:id`
- `POST/GET /api/wishlist`
- `PUT /api/wishlist/:id`
- `POST /api/wishlist/:id/convert-to-purchase`
- `GET /api/analytics/overview`
- `GET /api/analytics/spending-trend?range=12m`
- `GET /api/analytics/brand-share?range=12m`
- `GET /api/analytics/category-share?range=12m`
- `GET /api/analytics/purchase-frequency?granularity=week|month`
- `POST /api/upload`
- `GET/POST /api/settings/categories`
- `GET /api/settings/brands`
- `GET/PUT /api/settings/rating-dimensions`
- `GET /api/settings/backup`

## 测试

```bash
npm run test
```

当前提供：
- 业务规则单元测试（金额、评分、品牌归一化）
- 校验器集成测试（购买、装备、心愿转购买 payload）

## Supabase 保活

项目内置了两个轻量路由：

- `GET /api/internal/keepalive`
  使用 `KEEPALIVE_TOKEN` 鉴权，执行只读 SQL `SELECT 1, NOW()`，适合 GitHub Actions 定时访问以维持 Supabase 活跃度。
- `GET /api/health`
  Edge Runtime 的极轻量健康检查，同样使用 `KEEPALIVE_TOKEN` 鉴权，返回 `200` 和时间戳，不访问数据库。

GitHub Actions 工作流位于 `.github/workflows/supabase-keepalive.yml`，当前配置为每天执行一次。

需要的配置：

- 仓库 Secret：`KEEPALIVE_TOKEN`
- Vercel / 本地环境变量：`KEEPALIVE_TOKEN`

本地测试上传时，还需要把 Vercel 的真实 `BLOB_READ_WRITE_TOKEN` 同步到 `.env.local`。

## 第二阶段预留

数据模型已预留 `activity_sessions` 与 `APPLE_HEALTH` source，用于后续 iOS 健身羽毛球数据导入与消费联动分析。
