# Vercel 部署与运行约束

## 1. 为什么采用当前入口

Vercel 要求 Serverless Function 从 `api/` 暴露入口。`api/index.js` 只导出 `server/src/app.js` 创建的 Express 应用，使本地 Node 服务和 Vercel Function 复用同一套路由、中间件及错误处理。

`vercel.json` 中的重要配置：

- `buildCommand` 使用 `npm run vercel:build`，先生成 Prisma Client，再构建前端。
- `outputDirectory` 指向 `server/dist`，与 Vite 输出和 Express 静态目录保持一致。
- `/api/:path*` 重写到单个 Function；其他路径回退到 `index.html`，支持 React Router history 路由刷新。
- Function `maxDuration` 为 60 秒，但普通 API 不应把该上限当作可接受响应时间。

## 2. Serverless 约束

Vercel Function 可能冷启动、水平扩展或被回收：

- 不能把内存变量当作跨请求、跨实例的一致存储。
- 本项目的内存登录限流只能作为单实例基础保护；生产级全局限流需要共享存储或平台能力。
- Prisma Client 在开发时通过全局变量复用，降低热更新反复建立连接的问题。
- 应使用 Neon 的池化连接处理 Function 的突发并发，避免每个实例消耗过多数据库连接。
- 不把需要持久化的文件写入 Function 临时文件系统；静态资源应在构建阶段生成或放在对象存储。

## 3. 环境变量

| 变量                                | 使用位置           | 说明                               |
| ----------------------------------- | ------------------ | ---------------------------------- |
| `POSTGRES_PRISMA_URL`               | Prisma `url`       | 在线 API 使用的 Neon 池化连接      |
| `DATABASE_URL_UNPOOLED`             | Prisma `directUrl` | 迁移、备份等需要会话语义的直连连接 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 初始化脚本         | 只在管理员初始化时需要             |
| `NODE_ENV`                          | 服务配置           | Vercel 生产运行时自动设置          |

应用流量必须使用池化连接；迁移和 `pg_dump` 应使用非池化直连。不要在浏览器代码、日志或提交中暴露任何连接串。

## 4. PWA 与发布

Service Worker 位于站点根路径才能控制整个 SPA。它不会缓存 `/api`，避免缓存登录态和业务数据；导航使用 Network First，同源静态资源使用 Cache First。

修改应用外壳或缓存策略时必须递增 `CACHE_NAME`。Vite 生成的 JS/CSS 带内容哈希，但运行时图片等缓存仍需关注容量和过期策略。发布后应检查 Manifest、Service Worker、离线入口和深层 React Router URL。

## 5. 部署前检查

1. `npm test`
2. `npm run format:check`
3. `npm run vercel:build`
4. 确认生产环境变量已配置且连接类型正确。
5. 在 Preview 环境验证登录、搜索、收藏、管理员权限和深层路由刷新。
6. 确认构建过程没有执行数据库迁移；数据库变更应通过独立、可审计的迁移流程完成。
