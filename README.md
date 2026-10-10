# ABC English

ABC English 是一个按 CEFR 等级（A1–C2）组织的英语词汇学习网站。项目包含分类浏览、站内搜索、字段遮罩、例句、收藏夹、用户管理、管理员数据浏览、浅色/深色主题、阅读字号设置和 PWA 安装能力。

## 技术架构

- 前端：React 18、React Router、Vite、Alibaba Fusion Next
- API：Express，部署为单个 Vercel Node.js Function
- 数据存储：Neon Postgres + Prisma
- 托管：Vercel 静态资源与 Vercel Functions

浏览器通过同域 `/api` 请求后端，不需要公开额外的 API 地址或配置跨域。

## 关联项目

本项目关联一个独立的私有配套仓库：[abc-english-site-private](https://github.com/weizhiqimail/abc-english-site-private)。该仓库不公开，访问需要单独授权；具体职责和使用说明以其私有 README 为准。

## 目录说明

```text
api/                 Vercel Serverless 入口
prisma/postgres/     Postgres 模型与版本化 SQL 迁移
server/src/          Express API、认证、收藏与词汇服务
web/src/             React 前端
web/src/https/       Axios 基础服务与业务请求方法
web/public/          PWA manifest、Service Worker 与图标
vercel.json          Vercel 构建、函数和 SPA 路由配置
```

`server/dist` 和 `server/generated` 是构建产物，不提交到版本库。启动 API 和执行 Vercel 构建时会自动重新生成 Prisma Client，因此可以安全清理这些目录。

## Vercel 环境变量

生产、预览和开发环境变量应在 Vercel 项目设置中配置，或使用 `vercel env` 管理。

| 变量                    | 必需     | 用途                           |
| ----------------------- | -------- | ------------------------------ |
| `POSTGRES_PRISMA_URL`   | 是       | Neon 池化连接，供线上 API 使用 |
| `DATABASE_URL_UNPOOLED` | 是       | Neon 非池化直连，供迁移使用    |
| `ADMIN_USERNAME`        | 初始化时 | 初始管理员用户名               |
| `ADMIN_PASSWORD`        | 初始化时 | 初始管理员密码，至少 12 位     |
| `NODE_ENV`              | 否       | Vercel 生产运行时自动设置      |

建议将连接变量和管理员密码标记为 Sensitive。环境变量变更只对之后的新部署生效。

## 首次部署

```bash
npm install
npx vercel login
npx vercel link
npm run deploy:vercel
```

部署前应在 Vercel 中配置数据库连接环境变量，并确保 Postgres 已经由私有配套项目完成建表和数据维护。公开项目不会主动修改数据库结构或初始化数据；Vercel 构建只生成 Prisma Client 和前端产物。

## 本地开发

```bash
npm install
npx vercel link
npm run dev
```

`dev` 和 `server` 会先自动生成 Prisma Client，即使清理过 `.gitignore` 中的构建产物也能正常启动。前端默认运行在 `http://localhost:5173`，API 默认运行在 `http://127.0.0.1:3211`。Vite 会把 `/api` 代理到本地 API。

## 常用命令

```bash
npm run dev                  # 同时启动前端和 API
npm run server               # 只启动 API（自动生成 Prisma Client）
npm run web:build            # 构建前端
npm run vercel:build         # 完整 Vercel 构建
npm run db:generate          # 仅生成 Prisma Client，不修改数据库
npm test                     # 运行单元测试
npm run test:smoke           # 对已启动的 API 执行冒烟测试
npm run format:check         # 检查代码格式
```

更完整的架构、开发、部署和重点模块说明见 [`docs/`](docs/01-项目概览与架构.md)，项目编码约束见 [`docs/06-代码规范.md`](docs/06-代码规范.md)。

## 服务日志与错误留存

- Vercel Function 使用单行 JSON 结构化日志，包含请求 ID、路径、状态码、耗时、部署环境和 Vercel invocation ID；响应也会返回 `x-request-id`，便于从用户报错定位日志。
- 普通请求日志由 Vercel Runtime Logs 管理并按当前套餐的保留周期自动过期，不写入 Serverless 临时文件系统。
- 未预期的 `5xx` 错误会在输出到 Vercel 的同时，脱敏后持久化到 Postgres `error_logs` 表；管理员可在“数据库”页面查看。
- 密码、Cookie、Token、Authorization 和 API Key 不写入日志；URL 查询字符串也不会进入长期错误记录。
- 如果数据库日志写入失败，业务错误处理仍会正常返回，写入失败原因仅输出到 Vercel，避免日志系统形成级联故障。

Vercel Runtime Logs 对单次请求有行数和总量限制，因此服务只记录请求完成、请求失败和日志持久化失败等关键事件，不输出请求体或逐步调试噪声。

## 数据与认证

- 业务数据全部由在线 Postgres 提供；公开仓库不保存采集正文、解析结果、数据库备份或维护脚本。
- 数据采集、批量维护、对象存储、TTS 和数据库备份工具位于私有配套仓库。
- 登录使用 HttpOnly、SameSite=Lax Cookie。
- 密码使用 bcrypt 哈希；登录令牌只保存 SHA-256 摘要。
- 管理员数据浏览接口会对密码哈希和令牌摘要进行脱敏。
- 主题与字号设置保存在浏览器 Local Storage。
- 图片优先使用对象存储地址，不可用时回退到来源地址。

## PWA

生产环境通过 HTTPS 提供 manifest 和 Service Worker。用户可从设置页或浏览器菜单安装应用。Service Worker 缓存页面外壳与静态资源，但不会缓存 `/api` 响应。
