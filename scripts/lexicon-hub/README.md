# Lexicon Hub

Lexicon Hub 是仅供本地使用的 Express + EJS + Bootstrap 词汇管理工具。页面浏览与会产生写入的批量操作相互分离，不需要前端构建步骤。

## 快速开始

```bash
npm install
npm install --prefix scripts/qiniu
npm run lexicon:dev
```

打开 `http://127.0.0.1:3220/vocabulary`、`/operations` 或 `/tasks`。`lexicon:dev` 自动读取 Vercel Development 环境变量；已有完整本地变量时可运行：

```bash
npm --prefix scripts/lexicon-hub run start:local
```

## 页面与路由

顶部导航分为两部分：

- `/vocabulary`：词汇数据浏览。
- `/operations`：图片迁移、音标和发音补全等写操作。

词汇管理的左侧导航对应三个独立页面：

- `/vocabulary/levels`：词汇等级汇总。
- `/vocabulary/categories`：全部词汇分类。
- `/vocabulary/words`：词汇列表。

路径参数用于表达明确的资源层级：

- `/vocabulary/levels/:level`：指定等级下的分类。
- `/vocabulary/categories/:categoryRecordId`：指定分类下的词汇。

列表筛选和分页使用查询参数，例如：

```text
/vocabulary/words?level=B1&category=123&keyword=apple&page=2
```

## 七牛图片同步状态

PostgreSQL 的 `vocabulary_words` 表是词汇图片发布状态的唯一事实来源。页面不会扫描七牛目录，也不会使用通用上传工具的 `manifest.json` 判断图片是否完成。

相关字段：

- `owned_image_status`：`pending`、`uploading`、`published` 或 `failed`。
- `owned_image_url`：图片公开访问地址。
- `owned_image_object_key`：七牛对象 key。
- `owned_image_error`：最近一次迁移失败的错误信息。

处理顺序如下：

1. 下载前把状态写为 `uploading` 并清除旧错误。
2. 校验原图域名、HTTPS、MIME、重定向次数和大小。
3. 上传图片到七牛。
4. 七牛成功返回后，一次性写入 object key、公开 URL 和 `published`。
5. 任一步骤失败时写入 `failed` 和错误信息，之后可以重试。

服务若在处理中被强制终止，记录可能暂时保留为 `uploading`；再次执行该词汇的迁移即可恢复。已同时具有 `published` 和公开 URL 的记录会被跳过。没有原始图片的词汇不会进入增量上传队列，也不会计为失败。

业务站点使用 `owned_image_url（七牛） > photo_url（原图） > 无图片`。数据库一致性目标是：有原图则同时有七牛 URL；没有原图则两者都为空。原图字段用于追溯和回退，不能被七牛 URL 覆盖。

## 操作页约束

`/operations` 默认打开 A1 的第一个分类。页面始终要求一个明确等级和一个明确分类，不提供“全部等级”或“全部分类”选项，也不做分页。点击“选择本分类全部词汇”会选择当前分类加载出的所有词汇，后端不设置固定数量上限，并以 3 个 worker 控制实际处理并发。

切换等级时，页面自动进入该等级的第一个分类；分类参数不属于所选等级时，服务也会回退到该等级的第一个分类，避免跨等级或无分类查询。

## 本地批量任务

`/tasks` 是独立的批量任务页面。它与即时操作页分开，使用通用任务类型注册表，当前提供“词汇图片同步到七牛云”，以后可以在 `src/tasks/taskRegistry.js` 中注册 Google Cloud 等新任务，不需要重写任务进度页面。

任务页面支持：

- 直接选择一个词汇等级，不显示或手工选择单个词汇。
- 后端读取该等级下全部符合条件的词汇，组成一个完整大任务。
- 设置每批处理数量，范围为 1–100，默认 100。例如 2000 个词汇会自动拆成 20 批，而不是只处理前 100 个。
- 选择是否忽略已经发布到七牛的词汇；开启时先在数据库查询阶段排除已同步词汇，关闭后会把该等级全部词汇纳入任务并强制重新上传。
- 后台执行任务，页面通过 Server-Sent Events 实时更新，不需要手动刷新。
- 实时展示任务 ID、运行状态、总百分比、当前批次、本批进度、已完成数量、当前词汇 ID、成功、失败和跳过数量。

任务 API：

- `POST /api/tasks`：创建任务。
- `GET /api/tasks/:taskId`：读取任务当前快照。
- `GET /api/tasks/:taskId/events`：订阅 SSE 实时进度。

任务状态保存在当前 Lexicon Hub 进程内，适合本地批处理。服务重启会清空历史任务，但已经成功写入 PostgreSQL 和七牛的结果不会丢失。

## 详细日志

日志写入 `scripts/lexicon-hub/logs/`，该目录已加入 `.gitignore`。日志采用面向人工阅读的文本块格式：每条记录明确列出本地时间、ISO 时间、级别、任务名称、状态、正在执行的内容、耗时、批量进度以及参数、结果和其他上下文。参数和结果部分使用缩进 JSON，既方便阅读，也保留可检索的字段结构。

文件名按本机日期和五位分片序号生成：

```text
YYYY-MM-DD-00001.log
YYYY-MM-DD-00002.log
```

单个文件最大 10 MiB。写入下一条日志会超过限制时，自动切换到同一天的下一个文件；日期变化时从新日期继续编号。单条异常大的记录会保留预览并标记 `detailsTruncated`，保证日志文件不会被单条记录撑破。

早期生成的纯 JSON 日志不会被改写；检测到旧格式后，新版日志会自动开始当天的下一个编号文件，避免两种格式混在同一个文件中。

当前日志范围包括：

- 服务启动、启动失败、停止过程。
- HTTP 请求方法、URL、路由参数、查询参数、请求体、请求头、来源地址、响应状态、响应大小和耗时。
- PostgreSQL 查询条件、结果数量、图片状态更新、音标及音频发布结果。
- 原图下载地址、限制参数、最终地址、MIME、文件大小及错误。
- 七牛图片和音频的 object key、MIME、大小、覆盖策略及上传结果。
- 音标解析请求和候选结果。
- Google TTS 请求、voice 参数、fingerprint、MIME、音频大小及错误。
- 批处理输入、规范化后的词汇 ID、逐项结果和成功/失败统计。

日志模块会自动将密码、Cookie、Authorization、token、secret、credential、Access Key 和 Private Key 等字段替换成 `[REDACTED]`。Buffer 及合成音频不写入正文，只记录类型和字节数，避免泄露凭据或让日志被二进制数据撑满。

## 七牛对象目录

词汇图片使用固定规则：

```text
abc-english/vocabulary/images/v1/{wordId}/{完整SHA256}.{扩展名}
```

- `v1` 是路径规则版本，未来改变压缩或编码规则时可以使用新版本而不覆盖旧资产。
- `wordId` 用于从对象路径定位业务记录。
- 文件名是图片内容的完整 SHA-256，相同内容会得到稳定路径。
- 扩展名来自实际响应 MIME，不信任原始 URL 的后缀。

旧版路径曾在 `wordId` 前增加 SHA-256 前两位分片。七牛是对象存储，不需要依赖磁盘目录分片，因此新上传不再生成这一层；已有对象和数据库 key 保持不变，无需为了路径外观重新上传。

原始 `photo_url` 和 `photo_thumbnail_url` 会继续保留，自有图片只写入上述 `owned_image_*` 字段。词汇图片与发音资源直接使用七牛底层对象服务，因为它们的索引和状态由数据库维护；只有通用文件上传任务才维护模块 `manifest.json`。

## 代码结构

```text
src/
├─ app.js                 # Express 中间件与路由装配
├─ cli/                   # 可重复执行的本地维护命令
├─ controllers/           # 页面请求编排
├─ logging/               # 人类可读日志、HTTP requestId 和 10 MiB 轮转
├─ presenters/            # 数据到页面模型的转换
├─ routes/                # 页面与 API 路由
├─ repositories/          # PostgreSQL 访问和状态写入
├─ services/              # 图片迁移与词汇补全流程
├─ tasks/                 # 可扩展任务注册表、执行状态和实时进度
├─ public/                # 浏览器 CSS 和 JavaScript
└─ views/                 # 页面及可复用 EJS partials
```

路由只声明 URL，控制器负责读取请求和选择视图，repository 负责持久化，service 负责业务流程。不要把业务判断重新放回 EJS 模板或 `app.js`。

## 环境变量

- `ABC_ENGLISH_PRIVATE_ROOT`：独立本地维护工作区根目录；默认 `D:\program\abc-english-site-private`。
- `POSTGRES_PRISMA_URL`、`DATABASE_URL_UNPOOLED`、`POSTGRES_URL_NON_POOLING` 或 `POSTGRES_URL`：PostgreSQL 连接。
- `PHONETIC_DATA_FILES`：一个或多个 JSON/JSONL 文件，以系统路径分隔符分开。
- Google Application Default Credentials，或官方 SDK 支持的服务账号变量。
- qiniu 模块 README 中列出的 `QINIU_*` 变量。
- `LEXICON_IMAGE_ALLOWED_HOSTS`：允许下载原图的域名，默认 `cdn.langeek.co`。
- `LEXICON_IMAGE_MAX_BYTES`：单张原图最大字节数，默认 10 MiB。
- `LEXICON_HUB_HOST` / `LEXICON_HUB_PORT`：默认 `127.0.0.1:3220`。

后续需要访问本地维护文件的任务应通过配置中的 `privateWorkspaceRoot` 或 `privateScriptsRoot` 解析路径，不得从公开项目目录读取。

先执行 `prisma/postgres/migrations/002_lexicon_assets.sql` 和 `003_vocabulary_owned_image.sql`。该服务应只绑定本机，不要把批处理接口无鉴权暴露到公网。

## 开发命令

在项目根目录运行：

```bash
npm run lexicon:dev
npm run lexicon:start
npm run lexicon:format
npm run lexicon:format:check
```

增量同步全部等级中“有原图但没有七牛 URL”的图片：

```bash
npm --prefix scripts/lexicon-hub run sync:images
```

任务每批100条、并发3，重复执行不会重传已发布图片，结束后输出两套 URL 的一致性统计。只处理指定等级的底层示例：

```bash
npm run env:development -- node scripts/lexicon-hub/src/cli/syncImages.js --levels=A2,B1
```

运行测试：

```bash
npm --prefix scripts/lexicon-hub test
```

`lexicon:dev` 和 `lexicon:start` 会通过统一的 `env:development` script 读取 Vercel Development 环境。只有完整变量已写入本地环境时，才在本目录执行 `npm run start:local`。

开发模式会同时监听 `lexicon-hub/src`、`scripts/qiniu`、`scripts/tts` 和 `scripts/phonetic`。修改共享服务模块后 nodemon 会自动重启，避免进程继续使用 Node 模块缓存中的旧实现。
