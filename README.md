# ABC English

ABC English 是一个按 CEFR 等级（A1–C2）组织的英语词汇学习网站。项目包含分类浏览、站内搜索、字段遮罩、例句、收藏夹、用户管理、管理员数据浏览、浅色/深色主题、阅读字号设置和 PWA 安装能力。

## 技术架构

- 前端：React 18、React Router、Vite、Alibaba Fusion Next
- API：Express，部署为单个 Vercel Node.js Function
- 数据存储：Neon Postgres + Prisma
- 托管：Vercel 静态资源与 Vercel Functions

浏览器通过同域 `/api` 请求后端，不需要公开额外的 API 地址或配置跨域。

## 目录说明

```text
api/                 Vercel Serverless 入口
prisma/postgres/     Postgres 模型与版本化 SQL 迁移
scripts/             可公开的辅助服务
server/src/          Express API、认证、收藏与词汇服务
web/src/             React 前端
web/public/          PWA manifest、Service Worker 与图标
vercel.json          Vercel 构建、函数和 SPA 路由配置
```

`server/dist` 和 `server/generated` 是构建产物，不提交到版本库。

## Vercel 环境变量

生产、预览和开发环境变量应在 Vercel 项目设置中配置，或使用 `vercel env` 管理。

| 变量                    | 必需     | 用途                           |
| ----------------------- | -------- | ------------------------------ |
| `POSTGRES_PRISMA_URL`   | 是       | Neon 池化连接，供线上 API 使用 |
| `DATABASE_URL_UNPOOLED` | 是       | Neon 非池化直连，供迁移使用    |
| `DATABASE_PROVIDER`     | 是       | 设置为 `postgres`              |
| `ADMIN_USERNAME`        | 初始化时 | 初始管理员用户名               |
| `ADMIN_PASSWORD`        | 初始化时 | 初始管理员密码，至少 12 位     |
| `NODE_ENV`              | 否       | Vercel 生产运行时自动设置      |

建议将连接变量和管理员密码标记为 Sensitive。环境变量变更只对之后的新部署生效。

## 首次部署

```bash
npm install
npx vercel login
npx vercel link
npx vercel env add DATABASE_PROVIDER production,preview,development --value postgres --no-sensitive --yes
npx vercel env add ADMIN_USERNAME production
npx vercel env add ADMIN_PASSWORD production --sensitive
npx vercel env run -e production -- npm run db:migrate:postgres
npx vercel env run -e production -- npm run db:seed-admin
npm run deploy:vercel
```

部署前应确保 Postgres 中已经存在业务所需数据。Vercel 构建仅生成 Prisma Client 和前端产物。

## 本地开发

```bash
npm install
npx vercel link
npm run db:generate:postgres
npm run site:dev
```

前端默认运行在 `http://localhost:5173`，API 默认运行在 `http://127.0.0.1:3211`。Vite 会把 `/api` 代理到本地 API。

## 常用命令

```bash
npm run site:dev             # 同时启动前端和 API
npm run web:build            # 构建前端
npm run vercel:build         # 完整 Vercel 构建
npm run db:generate:postgres # 生成 Prisma Client
npm run db:migrate:postgres  # 初始化 Postgres 表
npm run db:seed-admin        # 创建初始管理员
npm run site:test            # API 冒烟测试
npm run format:site:check    # 检查代码格式
```

## 辅助服务

| 模块          | 用途                   | 常用命令                                  |
| ------------- | ---------------------- | ----------------------------------------- |
| `lexicon-hub` | 本地词汇管理和批量任务 | `npm run lexicon:dev`                     |
| `qiniu`       | 对象存储上传           | `npm run qiniu:upload -- demo ./file.png` |
| `phonetic`    | IPA 音标解析与规范化   | 由 Node API 调用                          |
| `tts`         | Google TTS 发音合成    | 由 Node API 调用                          |

更多说明见 [`scripts/README.md`](scripts/README.md) 及各模块 README。

## 数据与认证

- 业务数据由 Postgres 提供。
- 登录使用 HttpOnly、SameSite=Lax Cookie。
- 密码使用 bcrypt 哈希；登录令牌只保存 SHA-256 摘要。
- 管理员数据浏览接口会对密码哈希和令牌摘要进行脱敏。
- 主题与字号设置保存在浏览器 Local Storage。
- 图片优先使用对象存储地址，不可用时回退到来源地址。

## PWA

生产环境通过 HTTPS 提供 manifest 和 Service Worker。用户可从设置页或浏览器菜单安装应用。Service Worker 缓存页面外壳与静态资源，但不会缓存 `/api` 响应。
