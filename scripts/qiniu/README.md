# 七牛云脚本模块

该目录是七牛云相关任务的独立包，拥有自己的 `package.json` 和依赖，不参与主站 Vercel 依赖安装。`core` 封装 SDK 和配置，`services` 提供对象存储与清单能力，`tasks` 保存具体任务。以后增加下载、删除、同步等功能时，请在 `tasks` 下建立新目录，不要继续堆进上传模块。

```text
scripts/qiniu/
├─ core/                       # 七牛 SDK 客户端、配置、路径规则
├─ services/
│  ├─ objectStorageService.js  # 底层对象上传，不处理业务索引
│  ├─ uploadService.js         # 按模块上传并维护 manifest
│  └─ manifestService.js       # 模块清单读写
├─ tasks/upload/               # 当前上传任务和 CLI
├─ tests/
└─ package.json                # 七牛工具自己的依赖
```

首次使用先单独安装依赖：

```bash
npm install --prefix scripts/qiniu
```

## 环境变量

- `QINIU_ACCESS_KEY`：七牛 Access Key
- `QINIU_SECRET_KEY`：七牛 Secret Key
- `QINIU_BUCKET`：空间名称
- `QINIU_ZONE`：区域，支持 `z0`、`z1`、`z2`、`na0`、`as0`、`cn-east-2`，默认 `z0`
- `QINIU_PUBLIC_BASE_URL`：绑定的公开 HTTP 或 HTTPS 域名。建议明确包含协议；裸域名默认使用 HTTP，缺失时底层服务会通过七牛 Bucket API 查询已绑定域名。
- `QINIU_CALLBACK_URL`：七牛上传完成后回调的公网 HTTPS 地址，可选；当前 Lexicon Hub 服务端上传不依赖回调
- `QINIU_CALLBACK_BODY`：回调表单模板，可选，默认包含 key、hash、bucket、文件大小和 MIME
- `QINIU_CATALOG_ROOT`：本地清单镜像目录，可选

这些变量应配置在 Vercel Development 环境中，不需要新增本地 env 文件。

## Bucket 创建后需要完成的配置

1. 在七牛密钥管理中创建 Access Key 和 Secret Key，分别配置为 `QINIU_ACCESS_KEY`、`QINIU_SECRET_KEY`。Secret Key 只能放服务端环境变量，不能写入页面或提交到 Git。
2. 将空间名称配置为 `QINIU_BUCKET`，将实际区域配置为 `QINIU_ZONE`。华东、华北、华南、北美、东南亚等区域必须与 Bucket 创建时选择的区域一致，否则上传会失败。
3. 给 Bucket 绑定 CDN/对象访问域名，并建议配置 `QINIU_PUBLIC_BASE_URL`，例如 `http://media.example.com` 或 `https://media.example.com`。不要在末尾添加 `/`。HTTP 和 HTTPS 都会原样保留，裸域名默认补充 `http://`。未配置时服务会通过七牛 API 查询 Bucket 域名；若 Bucket 也没有绑定域名，会在上传前停止，避免产生无法发布 URL 的孤儿对象。Lexicon Hub 会把最终域名与 object key 拼成长期地址并写入 `vocabulary_words.owned_image_url`。
4. 推荐生产 Bucket 设为私有写入。若使用公开读，开启 HTTPS、合理缓存和防盗链；若使用私有读，当前代码还需要增加长期鉴权 URL 方案，不能把短期签名 URL 持久化进数据库。
5. 在 Vercel 项目 `abc-english-site` 的 Development 环境中添加上述变量。当前变量缺失时页面仍可查看，但点击上传会返回明确错误，不会产生半条数据库记录。

建议配置清单：

```text
QINIU_ACCESS_KEY=服务端AccessKey
QINIU_SECRET_KEY=服务端SecretKey
QINIU_BUCKET=abc-english-media
QINIU_ZONE=z0
QINIU_PUBLIC_BASE_URL=https://media.example.com
```

## 回写 URL 与上传回调

“公开访问 URL”和“上传完成回调 URL”是两件事：

- `QINIU_PUBLIC_BASE_URL` 是浏览器读取图片/音频使用的域名，当前业务必须配置。
- `QINIU_CALLBACK_URL` 是七牛在上传完成后主动 POST 的服务端地址。当前 Lexicon Hub 使用服务端 SDK 上传，并直接校验七牛响应后写数据库，因此不需要回调也能保证一致性。

若以后改成浏览器直传，可设置：

```text
QINIU_CALLBACK_URL=https://your-public-api.example.com/api/qiniu/callback
QINIU_CALLBACK_BODY=key=$(key)&hash=$(etag)&bucket=$(bucket)&fsize=$(fsize)&mimeType=$(mimeType)
```

回调地址必须是七牛可以访问的公网 HTTPS 地址，不能使用 `127.0.0.1`、局域网地址或仅本机可见的 Lexicon Hub。回调处理器必须验证七牛回调签名、检查 bucket/key 前缀、保证幂等，再更新数据库。当前代码只负责把可选回调参数写进上传凭证；在真正启用浏览器直传前，不要配置 `QINIU_CALLBACK_URL`。

## 本项目的对象目录规划

```text
abc-english/
├─ vocabulary/
│  └─ images/
│     └─ v1/{wordId}/{sha256}.{扩展名}
├─ tts/
│  └─ pronunciations/
│     └─ v1/{locale}/{词形hash前2位}/{pronunciationId}/{fingerprint}.mp3
├─ examples/
│  └─ audio/v1/                 # 未来例句音频
├─ indexes/
│  ├─ vocabulary-images/        # 未来可生成的分片索引
│  └─ pronunciation-audio/
└─ temporary/                   # 临时对象；设置生命周期自动删除
```

目录规则说明：

- 路径带 `v1`，以后调整压缩、voice 或生成规则时新增版本，不覆盖旧资产。
- 图片放在对应 `wordId` 目录下，以内容 SHA-256 作为文件名；不使用原始 URL 或未经清洗的词汇文本。
- 音频路径包含 locale、发音 ID 和请求 fingerprint，重复任务命中同一对象。
- 数据库是发布状态的唯一事实来源；七牛目录和索引是可恢复的派生数据。
- 只有七牛上传成功且返回 hash/key 后，服务才写入自有 URL 并标记 `published`。

## Lexicon Hub 图片迁移

Lexicon Hub 支持按等级创建完整图片任务，每批1–100条、默认100条、并发3。服务从原 `photo_url` 下载图片，限制来源域名、HTTPS、图片 MIME、重定向次数、超时和最大10 MiB，然后上传到上述目录。原有 `photo_url` 与 `photo_thumbnail_url` 会继续保留，自有图片写入：

- `owned_image_url`
- `owned_image_object_key`
- `owned_image_status`
- `owned_image_error`

可通过 `LEXICON_IMAGE_ALLOWED_HOSTS`（逗号分隔，默认 `cdn.langeek.co`）和 `LEXICON_IMAGE_MAX_BYTES` 调整下载白名单与大小限制。

直接增量同步所有等级：

```bash
npm --prefix scripts/lexicon-hub run sync:images
```

命令只处理有原图但没有 `owned_image_url` 的词汇。当前业务读取优先级是七牛 URL、原始 URL、无图片。

## 对象目录结构

每个业务模块都有独立前缀。例如模块 `A`：

```text
A/
├─ files/
│  ├─ picture.png
│  └─ document.pdf
└─ manifest.json
```

每次成功上传文件后，脚本都会更新并覆盖上传 `A/manifest.json`。清单包含对象 key、文件名、大小、MIME、七牛 hash、来源、公开地址、自定义元数据和上传时间。本地镜像默认保存在 `scripts/qiniu/data/A/manifest.json`。

## 上传本地文件

```bash
npm run qiniu:upload -- A D:\files\picture.png
```

代码调用：

```js
const { createUploadTask } = require("./scripts/qiniu");

const uploader = createUploadTask();
await uploader.uploadLocalFile({
  moduleName: "A",
  filePath: "D:/files/picture.png",
  relativeDirectory: "files/images",
  metadata: { ownerId: 1001 },
});
```

## 上传其他来源的文件流

调用方负责取得流，例如 HTTP 响应体、数据库内容或动态生成内容；上传模块不绑定具体来源。

```js
const { Readable } = require("node:stream");
const { createUploadTask } = require("./scripts/qiniu");

const uploader = createUploadTask();
await uploader.uploadStream({
  moduleName: "A",
  fileName: "remote.txt",
  stream: Readable.from("来自其他地方的内容"),
  size: Buffer.byteLength("来自其他地方的内容"),
  mimeType: "text/plain; charset=utf-8",
  source: { type: "remote-stream", url: "https://example.com/file.txt" },
  metadata: { usage: "example" },
});
```

流上传不会把原文件落到磁盘，只会写入模块清单的本地镜像。`size` 无法预先获知时可以不传，清单中将记录为 `null`。

## 给 TTS、图片等业务使用底层对象服务

`createUploadTask` 适合普通模块目录，会自动维护 `模块名/manifest.json`。TTS 音频和词汇图片需要数据库关系与分片索引，不能使用单个模块清单，因此应调用 `createObjectStorageTask`，由各业务自行生成稳定 object key 和索引。

```js
const { createObjectStorageTask } = require("./scripts/qiniu");

const storage = createObjectStorageTask();
await storage.uploadStream({
  objectKey: "abc-english/tts/pronunciations/v1/en-US/ab/123/hash.mp3",
  stream: audioStream,
  size: audioSize,
  mimeType: "audio/mpeg",
});
```

职责边界：

- 七牛底层对象服务：上传文件或流、返回 key/hash/大小/URL。
- 普通上传任务：在底层服务上维护每模块 `manifest.json`。
- TTS 服务：维护音标、音频数据库关系和 256 个分片索引。
- 图片迁移服务：维护图片资产、去重信息和图片索引。
