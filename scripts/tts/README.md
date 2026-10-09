# 词汇音标、语音与媒体资产方案

## 快速使用

当前默认 provider 是 Google Cloud TTS。首次使用需要安装官方 SDK，并配置 Application Default Credentials 或服务账号环境变量：

```bash
npm install @google-cloud/text-to-speech
gcloud auth application-default login
```

单条合成示例：

```js
const fs = require("node:fs/promises");
const { createTtsService } = require("./scripts/tts");

const tts = createTtsService();
const result = await tts.synthesize({ text: "hello", locale: "en-US" });
await fs.writeFile("hello.mp3", result.audio);
console.log(result.request, result.fingerprint, result.byteSize);
```

批量调用示例：

```js
const results = await tts.synthesizeMany(
  [
    { text: "hello", locale: "en-US" },
    { text: "hello", locale: "en-GB" },
  ],
  { concurrency: 2 },
);
```

可配置变量：

```text
TTS_PROVIDER=google
GOOGLE_TTS_VOICE_EN_US=en-US-Standard-C
GOOGLE_TTS_VOICE_EN_GB=en-GB-Standard-A
```

运行不访问 Google 的单元测试：

```bash
node --test scripts/tts/tests/*.test.js
```

生产流程通常由 Lexicon Hub 调用：先解析音标，再生成音频，七牛上传成功后才写数据库。不要把返回的 Buffer 输出到日志。

> 状态：基础服务已实现，生产批次需先完成凭据、音标数据许可与抽样验收
> 日期：2026-10-07
> 适用范围：当前约 10,878 条词汇、未来例句语音、现有词汇图片迁移

## 1. 结论

建议把这项工作拆成四条独立但可串联的流水线：

1. **音标采集与校验**：从词典数据源取得 IPA，并按美式、英式及词性保存。
2. **Google TTS 音频生成**：读取已确认的读音记录，分别生成 `en-US` 和 `en-GB` 音频。
3. **七牛媒体入库**：把音频流直接上传到专用 Bucket，并生成可分片的索引文件。
4. **数据库关联与发布**：七牛上传成功后才写入音频资产记录；页面只读取数据库中的已发布资产。

核心原则：

- 现有 `vocabulary_words`（词汇表）不重构、不塞入音标或音频 URL 数组。
- 音标、发音变体、音频资产分别建表，通过关联表与现有词汇连接。
- 数据库是业务关系的唯一事实来源；七牛 JSON 索引是可恢复、可审计、可对外消费的派生数据，不反向主导数据库。
- Google TTS、七牛、词典来源都封装成 provider，任务编排不依赖具体供应商。
- 先做词汇发音，验证质量和成本后再复用同一基础设施生成例句音频。

## 2. 第一个问题：Google Cloud TTS 能否提供英语音标

**不能直接提供。** Google Cloud Text-to-Speech 的职责是把文本或 SSML 合成为音频。`text.synthesize` 的成功响应只有 `audioContent`，没有 IPA、音素时间轴或词典释义字段。官方接口定义见 [Method: text.synthesize](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize)。

Google 支持的 `<phoneme>` SSML 标签是“输入控制”：调用方先提供 IPA 或 X-SAMPA，TTS 再按指定音素朗读。它不是把单词反向解析成 IPA。官方列出了 `en-US` 支持的音素与重音符号，见 [Supported phonemes and levels of stress](https://docs.cloud.google.com/text-to-speech/docs/phonemes?hl=en)。

因此必须采用两个来源：

| 数据          | 推荐来源                                         | Google TTS 的作用                |
| ------------- | ------------------------------------------------ | -------------------------------- |
| 美式/英式 IPA | 有授权的词典 API、可再分发的词典数据集或人工校对 | 不生成音标                       |
| 发音音频      | Google Cloud TTS                                 | 根据单词或经验证的 SSML 生成音频 |

不要从 TTS 音频再调用 Speech-to-Text 推导音标。这会增加成本和误差，而且语音识别结果仍然不是可靠的 IPA。

### 2.1 音标来源的选择标准

音标来源不能只看“能否请求”，还要确认：

- 是否同时提供 `en-US`、`en-GB`；
- 是否允许缓存进自己的数据库；
- 是否允许在产品页面展示和再分发；
- 是否能区分词性、同形异音词和多读音；
- 是否提供稳定的词条 ID、数据版本和更新策略；
- IPA 采用宽式还是严式标音，重音和音节符号是否统一。

在未确定合法的数据源前，音标字段应允许为空，任务状态记录为 `waiting_source`，不能用猜测值填充。

### 2.2 本项目采用的音标解决方案

推荐采用“**Wiktionary 结构化数据为主、CMUdict 交叉校验美音、人工处理例外**”的三层方案。这套方案不依赖 Google 返回音标，也不需要逐词请求不稳定的网页接口。

#### 第一层：Wiktionary/Wiktextract 作为主数据源

定期下载 English Wiktionary dump，使用 Wiktextract 生成的结构化 JSON，而不是抓取词条网页。Wiktionary 官方说明 dump 可以下载，并推荐 Wiktextract JSON 作为更容易处理的结构化形式；内容可在遵守 GFDL 或 CC BY-SA 条件下使用，见 [Wiktionary FAQ](https://en.wiktionary.org/wiki/Help:FAQ#Downloading_Wiktionary)。

每条候选音标至少保留：

- 原始单词和规范化单词；
- IPA 原文，不能在导入时丢掉重音符号；
- 地区标签，例如 `US`、`General American`、`UK`、`Received Pronunciation`；
- 词性和可能的释义标签；
- 是否为主要读音、罕见读音或过时读音；
- Wiktionary 页面名、dump 日期和来源版本；
- 原始 license 标记和归属信息。

地区映射规则应保守：

| 来源标签                       | 系统 locale        | 处理方式                             |
| ------------------------------ | ------------------ | ------------------------------------ |
| `US`、`General American`       | `en-US`            | 可自动导入                           |
| `UK`、`Received Pronunciation` | `en-GB`            | 可自动导入，但保留原标签             |
| `Australia`、`Canada` 等       | 对应 locale 或暂存 | 不错误归入英音/美音                  |
| 没有地区标签                   | `en`               | 作为待判定候选，不自动复制成两种口音 |

Wiktionary 数据采用共享许可，因此产品中要提供“发音数据来源与许可”页面，标明来源、许可链接和 dump 日期。数据库必须保存来源信息，以便单条记录追溯或删除。实施前应再确认最终的署名展示形式是否满足项目发布方式。

#### 第二层：CMUdict 校验和补充美音

[CMUdict](https://github.com/cmusphinx/cmudict) 是北美英语发音词典，覆盖十多万个词和多个候选读音。它使用 ARPAbet，不是可直接展示的 IPA。处理方式是：

1. 导入 CMUdict 的单词、读音序号和 ARPAbet；
2. 使用固定、带版本号的 ARPAbet→IPA 映射转换为宽式美式 IPA；
3. 同时保存 `raw_notation=ARPABET` 和原始音素，不能只保存转换结果；
4. 与 Wiktionary 的 `en-US` 候选比较；一致时提高置信度，不一致时进入报告；
5. CMUdict 只能补充美音，绝不能据此生成英音。

CMUdict 有时会为同一拼写提供多个读音，但通常缺少足够的词性和释义信息。因此它适合覆盖率补充和交叉校验，不适合独立决定页面上的主读音。

#### 第三层：缺失和冲突进入人工队列

以下记录不能自动发布：

- Wiktionary 与 CMUdict 的主要美音明显冲突；
- 同一拼写存在多个读音，但无法根据现有词性确定顺序；
- 专有名词、缩写、包含数字或异常符号的词；
- 只有无地区音标，无法确认英音或美音；
- IPA 包含当前规范未识别的符号；
- 音标存在但 Google TTS 抽样结果与音标明显不符。

人工页面需要并排显示：词汇、词性、释义、各来源 IPA、Google 试听音频和选择结果。人工确认只修改“选择/排序/验证状态”，不覆盖原始来源记录。

#### 不建议直接采用的方案

- **仅使用 CMUdict**：只有北美英语，而且 ARPAbet 转 IPA 会引入映射判断。
- **仅使用 eSpeak NG 自动转音标**：它适合作为缺失报告的候选提示，但规则生成结果不能不经校验直接发布。
- **直接抓词典网页**：结构不稳定，也可能违反站点条款或缺少批量使用许可。
- **把 open-dict-data/ipa-dict 当作唯一来源**：它确实提供 `en_US` 和 `en_UK`，但不同语言/地区数据继承不同上游许可；其英式数据注明源自 GPL 3.0 项目。若采用，必须逐项完成许可评估，不能只依据仓库顶层 MIT 标识。
- **让大模型生成 IPA**：无法保证一致性、地区标准和可追溯性，只可用于发现异常，不能成为正式来源。

#### 音标导入后的质量门槛

建议批量发布必须同时满足：

- 规范化后的词形精确匹配；
- locale 明确为 `en-US` 或 `en-GB`；
- IPA Unicode 字符通过白名单和结构校验；
- 同一来源没有无法解释的重复；
- 来源、版本和许可字段完整；
- 高频词、同形异音词和随机样本人工抽检通过；
- 抽样生成的 TTS 音频与目标口音一致。

建议首批先导入 100 个验证词，再扩大到 1,000 个，最后才处理全量。每一批输出覆盖率报告：唯一词数、命中率、美音覆盖率、英音覆盖率、多读音数量、冲突数量、人工待办数量和无结果词表。

## 3. 为什么“一个词汇一条音频”不够

一个拼写可能出现以下情况：

- 美式与英式读音不同，例如元音、重音或卷舌差异；
- 相同拼写因词性不同而重音不同；
- 同一地区存在多个被词典认可的读音；
- 数据库中相同单词可能在多个分类或释义下重复出现；
- TTS voice 更新后，需要保留旧资产并逐步切换。

因此关系应该是：

```text
现有词汇记录 vocabulary_words
  └─ 多对多关联 vocabulary_word_pronunciations
       └─ 发音变体 vocabulary_pronunciations
            └─ 多个音频版本 vocabulary_pronunciation_audio
```

音标与“发音变体”是一体的；音频是该发音变体在某个供应商、voice 和版本下的媒体实现。这样既能表达多个音标，也能在不修改音标的情况下重生成音频。

## 4. 建议的数据表

下面是逻辑设计，实施前再形成 Prisma migration。表名使用英文物理表名，同时给出管理员页面展示的中文名称。

### 4.1 `vocabulary_pronunciations`（词汇发音变体表）

| 字段                        | 用途                                                 |
| --------------------------- | ---------------------------------------------------- |
| `id`                        | 主键                                                 |
| `normalized_word`           | 规范化后的单词；查询和去重用，不替换原词汇文本       |
| `locale`                    | `en-US`、`en-GB`，未来可加 `en-AU` 等                |
| `ipa`                       | IPA 文本                                             |
| `alphabet`                  | 固定为 `IPA`，为未来 X-SAMPA 等预留                  |
| `part_of_speech`            | 可空；用于同形异音词                                 |
| `variant_label`             | `primary`、`secondary` 等                            |
| `source_provider`           | 音标来源                                             |
| `source_entry_id`           | 来源词条 ID                                          |
| `source_version`            | 来源数据版本                                         |
| `verification_status`       | `imported`、`verified`、`rejected`、`waiting_source` |
| `created_at` / `updated_at` | 审计时间                                             |

建议唯一约束：`normalized_word + locale + ipa + part_of_speech`。

### 4.2 `vocabulary_word_pronunciations`（词汇与发音关联表）

| 字段               | 用途                           |
| ------------------ | ------------------------------ |
| `word_id`          | 关联现有 `vocabulary_words.id` |
| `pronunciation_id` | 关联发音变体                   |
| `display_order`    | 页面顺序                       |
| `is_primary`       | 当前词条下的首选读音           |

建议唯一约束：`word_id + pronunciation_id`。这张表让重复出现的同一单词共享发音，又允许不同释义选择不同的首选读音。

### 4.3 `vocabulary_pronunciation_audio`（词汇发音音频表）

| 字段                                           | 用途                                                       |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `id`                                           | 主键                                                       |
| `pronunciation_id`                             | 关联音标/发音变体                                          |
| `provider`                                     | `google-cloud-tts`                                         |
| `voice_name`                                   | 固定到具体 voice，不能只存 `en-US`                         |
| `voice_locale`                                 | `en-US`、`en-GB`                                           |
| `audio_encoding`                               | 建议第一期使用 `MP3`                                       |
| `speaking_rate` / `pitch`                      | 保留生成参数                                               |
| `request_fingerprint`                          | 输入、voice、编码和参数的稳定摘要，用于幂等                |
| `bucket` / `object_key`                        | 七牛对象定位信息                                           |
| `public_url`                                   | 当前可播放 URL；私有空间时不保存短期签名 URL               |
| `qiniu_hash` / `byte_size`                     | 完整性与容量统计                                           |
| `duration_ms`                                  | 实际时长；上传后探测得到                                   |
| `status`                                       | `pending`、`generating`、`uploaded`、`published`、`failed` |
| `error_code` / `error_message` / `retry_count` | 重试和排错                                                 |
| `created_at` / `updated_at`                    | 审计时间                                                   |

建议唯一约束：`pronunciation_id + request_fingerprint`。

### 4.4 `media_generation_jobs`（媒体生成任务表）

词汇超过一万条，不能依赖一个长进程“一次跑完”。任务表记录：任务类型、目标 ID、尝试次数、下一次执行时间、锁定时间、状态、错误和批次号。它同时可服务未来的例句 TTS 与图片迁移。

任务至少分为：

- `enrich_vocabulary_incrementally`
- `resolve_pronunciation`
- `synthesize_pronunciation`
- `upload_pronunciation_audio`
- `publish_pronunciation_audio`
- `synthesize_example`
- `migrate_vocabulary_image`

## 5. Google TTS 封装边界

当前 `scripts/tts` 已按以下边界实现 Google provider、稳定指纹、单个调用与限并发批量调用；音标已拆分到独立的 `scripts/phonetic` 模块：

```text
scripts/tts/
├─ core/                 # 配置和 fingerprint
├─ providers/google/     # Google TTS 客户端
├─ services/             # 单个与批量合成
├─ tests/
└─ package.json          # 独立依赖；不提供 CLI
```

代码调用：

```js
const { createTtsService } = require("./scripts/tts");
const tts = createTtsService();
const one = await tts.synthesize({ text: "hello", locale: "en-US" });
const batch = await tts.synthesizeMany([
  { text: "hello", locale: "en-US" },
  { text: "hello", locale: "en-GB" },
]);
```

通用 TTS provider 的输入不应叫“word”，而应是：

- `entityType`: `pronunciation` 或 `example`
- `entityId`
- `text` 或 `ssml`
- `locale`
- `voiceName`
- `audioEncoding`
- `speakingRate`、`pitch`

这样未来增加例句时不需要复制 Google 客户端和七牛上传逻辑。

## 6. Voice 与生成参数策略

Google 提供 `en-US` 与 `en-GB` 多种 voice，voice 列表会变化，官方当前列表见 [Supported voices and languages](https://docs.cloud.google.com/text-to-speech/docs/list-voices-and-types?hl=en)。

第一期建议：

- 每个地区只选择一个固定 voice；不要随机挑选；
- 把具体 `voice_name` 存入数据库；
- 美音和英音都先生成一份；
- 使用相同的编码、语速和音量参数；
- 先抽样 100 个普通词、多音节词、缩写、专有名词和同形异音词，人工试听后再批量执行；
- 普通词可直接传文本；只有已验证音标且 Google 对目标 locale 支持 `<phoneme>` 时，才传 SSML；
- 不要盲目把 `en-US` IPA 填入 `en-GB` SSML。

格式第一期建议使用 MP3。Google 官方说明 MP3 输出为 32 kbps；OGG_OPUS 在相近码率下质量更高，但 Safari、旧设备和部分业务工具链的兼容验证成本更高。参见 [AudioEncoding](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/AudioEncoding)。如果未来确认所有目标浏览器都可靠支持 OGG Opus，可生成新版本并灰度切换。

## 7. 完整任务流程与一致性

### 7.1 单个发音的状态流

```text
音标已确认
  → 创建幂等任务
  → Google 合成音频到内存流
  → 计算摘要与大小
  → 上传七牛临时/目标 key
  → 校验七牛响应 hash
  → 数据库事务写入音频资产并标记 published
  → 更新对应的七牛分片索引
```

不能先把 URL 写入数据库再上传文件。否则页面会读到不可播放的地址。

### 7.2 幂等与重试

`request_fingerprint` 至少包含：规范化文本、IPA/SSML、locale、voice name、编码、语速、音调和生成规则版本。相同 fingerprint 已发布时跳过 Google 调用，避免重复计费。

重试策略：

- 429、5xx、网络中断：指数退避并加入随机抖动；
- 4xx 参数错误：不自动无限重试，进入人工检查报告；
- Google 成功、七牛失败：保留任务状态重新合成或在短期缓存有效时只重传；
- 七牛成功、DB 失败：用确定性 object key 重试 DB，不生成第二个对象；
- 每批设置最大请求数、最大字符数和最大失败率，超过阈值自动停止。

Google 当前同步请求正文上限为 5,000 bytes；普通词汇远低于限制，例句任务也应逐句生成。默认普通 voice 配额为每项目每分钟 1,000 请求，部分 voice 有单独配额，详见 [Quotas & limits](https://docs.cloud.google.com/text-to-speech/quotas)。实现时不应跑满上限，建议初始并发 5、每分钟 200～300 次，观察错误率后再调整。

### 7.3 新模块和新词汇的增量处理

全量生成只是第一次初始化。以后补充新的词汇模块、分类或少量词条时，必须只处理新增或缺失的部分，不能重新为全部词汇查询音标、调用 Google TTS 和覆盖七牛对象。

推荐把增量补全设计成独立任务 `enrich_vocabulary_incrementally`，它既可以接收本次导入返回的词汇 ID，也可以在没有导入批次信息时通过数据库差集自行发现遗漏。

#### 首选入口：导入任务主动提交增量清单

未来新增词汇的导入器完成数据库写入后，应输出一个不可变的 `import_batch_id`，并记录本批：

- 新增的分类或模块 ID；
- 新增的 `vocabulary_words.id`；
- 修改过单词文本或词性的词汇 ID；
- 删除或失效的词汇 ID；
- 导入来源、开始时间、结束时间和计数。

导入器只负责报告变化，不直接调用词典、Google 或七牛。随后由增量补全任务读取这个批次，便于失败续跑，也避免一次导入请求运行太久。

#### 兜底入口：数据库差集扫描

即使某次新增模块没有正确触发后续任务，也要能通过定期核对发现遗漏。差集扫描至少查找：

- 没有任何 `vocabulary_word_pronunciations` 关联的词汇；
- 有音标关联，但缺少 `en-US` 或 `en-GB` 主读音的词汇；
- 有读音，但没有 `published` 音频的发音变体；
- 数据库音频记录存在，但七牛 object key、hash 或索引缺失的记录；
- 生成规则版本或 voice 已升级、需要生成新版本的记录。

当前 `vocabulary_words` 没有 `created_at` / `updated_at`，所以不能只用“最近更新时间”发现增量。第一版应以关联表的 `NOT EXISTS` 差集为可靠兜底；以后如果增加导入批次表，也仍然保留差集扫描作为一致性检查。

#### 单个新增词汇的决策流程

```text
新词汇进入 vocabulary_words
  → 规范化拼写，但保留原始 word
  → 查询相同规范词形、locale、词性的已有发音
     ├─ 已有合适发音：只建立词汇关联，不查询词典、不重新生成音频
     └─ 没有合适发音：创建 resolve_pronunciation 任务
          → 导入/审核美音与英音 IPA
          → 针对每个缺失的已确认发音创建合成任务
          → Google 只生成缺少的音频
          → 七牛上传确定性 key
          → DB 发布
          → 只重建受影响的索引分片和 summary 计数
```

例如，新模块中增加 `alarm`，而其他模块已存在相同词形、相同词性和已发布的英美发音，则新词只增加两条关联记录，复用原音标和音频，Google 调用次数为 0，七牛上传次数为 0。如果增加的是同形异音词，则必须根据词性或释义进入匹配/人工确认，不能仅凭拼写复用。

#### 增量幂等规则

- 同一个 `import_batch_id + word_id` 只能产生一组有效补全任务；
- 音标唯一约束继续使用 `normalized_word + locale + ipa + part_of_speech`；
- 音频以 `pronunciation_id + request_fingerprint` 去重；
- 七牛 object key 包含 fingerprint，重复执行只命中同一对象；
- 任务启动前和写入前都再次检查目标是否已经完成，防止两个 worker 同时生成；
- 每个任务使用数据库锁定时间和租约，进程退出后可由下一次执行接管；
- 一批中某些词失败不能回滚已成功词汇，只记录失败项并支持定向重试；
- 增量报告必须列出：扫描数、直接复用数、新增音标数、Google 调用数、七牛上传数、人工待办数、失败数和预计/实际字符量。

#### 修改、删除与全量重建

- **只新增模块**：不触碰旧模块关联和旧音频。
- **修改词汇文本或词性**：重新评估关联；旧发音先标记为待清理，确认新关联发布后再解除旧关联。
- **删除词汇**：删除该词汇的关联，但发音和音频可能仍被其他词汇引用；引用计数为零后才进入延迟清理队列。
- **更换 voice 或生成规则**：生成新 fingerprint 的音频，发布成功后切换主版本；旧音频设置保留期后再删除。
- **数据库全量重建**：当前导入脚本的 `--replace` 会删除并重新创建词汇，数据库自增 ID 会改变。因此正式增加发音关联后，不能直接执行现有的破坏式全量替换；应改成按稳定业务身份 upsert，或在重建后用 `category_record_id + position + word_entry_id/translation_id + normalized_word` 生成的稳定键重新建立关联。

最后一条是上线前置条件：如果不先解决稳定身份问题，一次词汇全量重建就可能让所有 `word_id` 关联失效，虽然七牛音频仍在，但页面无法找到它们。

## 8. 七牛 Bucket 与对象目录

### 8.1 是否新建 Bucket

**建议新建专用生产 Bucket**，不要继续和个人零散文件混放。建议命名类似：

```text
abc-english-assets-prod
```

理由：

- Bucket 的公开/私有访问、防盗链、CORS、生命周期和监控策略通常是整体配置；
- 教学站点资源的流量风险与个人文件不同；
- 可以单独统计容量和 CDN 流量，并设置告警；
- 发生密钥泄漏或误删时，影响范围可控；
- 将来测试环境可使用独立 `abc-english-assets-dev`，避免污染生产索引。

如果短期不能新建 Bucket，可以先使用当前 Bucket 的 `abc-english/` 总前缀隔离，但这只是过渡方案，不能提供 Bucket 级权限和账单隔离。

### 8.2 推荐对象 key

```text
abc-english/
├─ tts/
│  ├─ pronunciations/v1/en-US/ab/<pronunciation-id>/<fingerprint>.mp3
│  ├─ pronunciations/v1/en-GB/cd/<pronunciation-id>/<fingerprint>.mp3
│  ├─ examples/v1/en-US/12/<example-id>/<fingerprint>.mp3
│  └─ indexes/
│     ├─ pronunciations/v1/ab.json
│     ├─ pronunciations/v1/cd.json
│     └─ summary.json
└─ vocabulary-images/
   ├─ originals/v1/34/<word-id>/<source-hash>.<ext>
   ├─ thumbnails/v1/34/<word-id>/<source-hash>.webp
   └─ indexes/v1/34.json
```

`ab`、`cd`、`12` 是 ID 或稳定 hash 的前两位，用于分片。七牛的目录本质上是 key 前缀，设计 key 时就要稳定。

不要维护一个包含一万多条记录、每次上传都整体覆盖的巨大 `manifest.json`。它会产生并发覆盖、缓存失效和单点损坏。建议：

- 256 个分片索引：按稳定 hash 前两位分片；
- 一个小型 `summary.json`：只记录 schema 版本、分片列表、记录总数和更新时间；
- 每个索引条目包含 `wordId`、`pronunciationId`、locale、IPA、object key、hash、大小和发布时间；
- 索引使用临时 key 上传成功后再移动/覆盖正式 key，避免客户端读到半截 JSON；
- 数据库仍是最终事实来源，索引可以随时由数据库重建。

### 8.3 访问与防盗链

对当前公开学习网站，推荐从易维护到高安全分两档：

**第一期：公开 Bucket + 自定义 CDN 域名**

- 配置 HTTPS；
- Referer 白名单加入生产域名、预览域名策略和本地开发域名；
- 生产环境建议不允许空 Referer，但要先验证浏览器音频、图片、预加载以及隐私策略是否会移除 Referer；
- CORS 仅允许实际站点域名及需要的 `GET`、`HEAD`；
- 设置流量、带宽和费用告警；
- 上传密钥只存在服务端，浏览器永远拿不到 AK/SK；
- 页面 URL 只通过数据库/API 返回，不暴露对象列举能力。

七牛支持 Referer 黑白名单和空 Referer 策略，见 [Referer 防盗链](https://developer.qiniu.com/kodo/8618/dev-preventing-hotlinking)。但 Referer 可以被非浏览器客户端伪造，它是降低盗链的手段，不是强身份认证。

**需要强控制时：私有 Bucket + 短期签名 URL**

- 页面向自己的后端请求短期播放地址；
- 数据库只保存 `bucket + object_key`，不保存会过期的签名 URL；
- 后端按用户权限签发；
- 缺点是增加 API 调用、缓存设计和播放失败后的续签逻辑。

七牛官方也建议通过私有空间、Referer、防盗链和 CORS 降低恶意访问及盗量风险，见 [降低被恶意访问、盗量的风险](https://developer.qiniu.com/kodo/12022/reduce-the-risk-of-be-malicious-access-stolen)。对于目前的公开词汇站，第一期通常足够；如果流量成本明显上升，再升级为私有空间或 CDN 时间戳防盗链。

## 9. 容量与成本估算

### 9.1 词汇音频容量

Google MP3 是 32 kbps，理论音频主体约为每秒 4 KB，另有容器和编码开销。单个词通常约 0.7～1.8 秒，实际规划可按 **5～12 KB/文件** 估算。

当前 10,878 条词汇，每条美音和英音各一份：

| 项目                           |               数量/估算 |
| ------------------------------ | ----------------------: |
| 音频文件数                     |                  21,756 |
| 按 5 KB/文件                   |               约 109 MB |
| 按 12 KB/文件                  |               约 261 MB |
| 加索引、失败重试残留和版本余量 | 建议按 0.3～0.6 GB 规划 |

如果平均每个词有 1.5 个发音变体，则约 32,634 个文件，建议按 **0.2～0.4 GB 实际数据、1 GB 容量预算**。真正可能产生持续成本的通常不是存储，而是 CDN 下行流量和重复播放。

### 9.2 例句音频容量

当前约 52,863 条例句。如果未来每句生成美音和英音，共约 105,726 个文件。按每句 3～8 秒、32 kbps 估算：

- 音频主体约 1.27～3.38 GB；
- 加容器开销、索引、多版本和失败残留，建议按 **2～5 GB** 规划；
- 若只生成一种口音，可近似减半。

因此例句应该按用户需求或热度分批生成，不必一开始全量双口音。

### 9.3 Google TTS 字符费用

Google 按送入合成服务的字符数计费，空格、换行和大多数 SSML 标签也计入。当前官方价目中，Standard voice 每月前 400 万字符免费；WaveNet、Neural2、Studio、Chirp 3 HD 等多为每月前 100 万字符免费，但价格和免费额度可能变化，而且必须启用 Billing。以执行时的 [Google Cloud TTS pricing](https://cloud.google.com/text-to-speech/pricing) 为准。

粗略判断：

- 仅把约一万个单词分别生成美音和英音，纯文本通常只有几十万字符，处于常见免费额度内；
- 如果为每个词加入较长 SSML `<phoneme>` 标签，计费字符会明显增加，Premium voice 可能接近 100 万字符档位；
- 五万多条例句双口音很可能超过免费额度，必须先按真实平均长度计算并设置预算告警；
- “在免费容量内”不能作为硬保证，因为 voice 类型、每月其他用量、重跑次数和价格都会影响账单。

## 10. 现有词汇图片迁移

当前 `vocabulary_words` 已有 `photo_url` 和 `photo_thumbnail_url` 外链。外站可能修改 URL、增加防盗链或删除资源，因此应迁移，但要独立于 TTS 任务执行。

建议流程：

1. 保存原 URL，不直接覆盖，便于追溯和失败回退；
2. 下载前检查协议、域名白名单、重定向次数、Content-Type 和 Content-Length；
3. 防止 SSRF：禁止访问 localhost、内网 IP、云元数据地址和非 HTTP(S) 协议；
4. 限制单文件大小，例如原图 10 MB、缩略图 2 MB；
5. 计算内容 hash，相同内容只保存一份；
6. 验证确实是可解析图片，而不是只相信扩展名和响应头；
7. 原图上传七牛，同时生成统一尺寸和格式的缩略图；
8. 七牛上传成功后写入独立媒体资产表，再把词汇与资产关联；
9. 页面先读自有资产，缺失时临时回退旧 URL；
10. 全量验证一段时间后，再考虑取消旧 URL 回退。

图片的版权和原站使用条款必须单独确认。“技术上可以下载”不代表“允许永久复制和公开分发”。

建议新增通用 `media_assets`（媒体资产表）和 `vocabulary_word_media`（词汇媒体关联表），使图片、未来插图和其他媒体可以复用统一的 bucket、object key、hash、MIME、大小和状态字段。音频仍保留发音专用表，因为它还有 voice、locale、IPA 和生成参数等强业务字段。

## 11. 凭据和运行环境

Google 官方 Node 客户端支持 Application Default Credentials，认证说明见 [Authenticate to Cloud TTS](https://docs.cloud.google.com/text-to-speech/docs/authentication)。本项目部署在 Vercel，不应把 Google 服务账号 JSON 或七牛 AK/SK 提交到仓库。

建议：

- Vercel 中保存 Google 项目、客户端邮箱和私钥等服务端变量；
- 私钥保留换行，读取时进行格式校验；
- 服务账号只授予调用 TTS 所需的最小权限，不授予 Owner/Editor；
- 七牛凭据只授予目标 Bucket 所需能力；如账号体系无法做细粒度限制，则使用独立账号/密钥并定期轮换；
- 批处理任务不能由公开 HTTP 接口任意触发；只允许管理员且要有批次上限；
- 日志严禁打印凭据、完整签名 URL、Google 原始认证错误体中的敏感内容；
- 大批量任务更适合本地受控脚本或专用 worker，不建议依赖一次 Vercel 请求跑完。

## 12. 已知问题和风险清单

### 数据与读音

- Google TTS 不提供 IPA，必须另选有授权的音标源。
- 同形异音词需要结合词性或释义，不能只按小写单词去重。
- TTS 的默认读法不一定与词典 IPA 完全一致。
- `<phoneme>` 支持因语言和 voice 而异，必须实测英音与美音。
- 专有名词、缩写、带连字符词、短语和大小写敏感词需要单独规则。

### 一致性

- Google 成功、七牛失败、数据库失败三类中间状态必须可恢复。
- 七牛索引不能作为主数据库，否则并发覆盖和回滚困难。
- URL 域名调整时，若数据库只存完整 URL，会产生全表更新；必须同时保存 object key。
- voice 或生成参数变化时不能原地覆盖旧版本，应生成新 fingerprint 后灰度发布。

### 成本与配额

- 免费额度按月和 voice SKU 计算，不代表无需开启结算。
- SSML 标签计入字符量，大规模重跑可能超额。
- 音频存储不大，但被盗链后的 CDN 流量可能远高于存储费用。
- 例句数量约为词汇数的五倍，且文本更长，应另设预算和开关。

### 图片迁移

- 外链来源可能禁止抓取或禁止再分发。
- URL 可能返回 HTML、重定向循环或超大文件。
- 下载远程 URL 会引入 SSRF 风险。
- 仅按 URL 去重不够，同一内容可能有多个 URL；应按内容 hash 去重。

### 产品体验

- 首次点击播放需要加载状态、失败重试和不可用提示。
- 移动浏览器可能限制自动播放，只应在用户点击后播放。
- 快速连续点击需要取消上一段播放，避免多个音频叠加。
- 页面要清楚标注“美音 / 英音”，多个读音按主次排序。
- 音频按钮不能阻断现有“显示词汇/翻译”的局部交互。

## 13. 推荐实施顺序

### 阶段 0：决策与小样本

1. 确定合法音标来源。
2. 新建七牛生产媒体 Bucket 和自定义域名。
3. 选定一个美音 voice、一个英音 voice 和 MP3 参数。
4. 用 100 个覆盖复杂场景的词建立人工验收样本。

验收条件：音标来源许可明确；读音准确率可接受；浏览器播放正常；单文件大小、字符费用和七牛流量可测量。

### 阶段 1：词汇发音

1. 增加发音、关联、音频和任务表。
2. 导入并校验 IPA。
3. 实现 Google provider、七牛发布器和分片索引。
4. 小批量 100 条、1,000 条、全量逐级执行。
5. 页面增加美音/英音播放，并保留失败回退。
6. 改造词汇导入器，使其输出 `import_batch_id` 和变化清单，并验证新增模块只触发增量任务。
7. 在启用发音外键前，解决现有 `--replace` 全量重建导致词汇 ID 变化的问题。

### 阶段 2：图片迁移

1. 增加媒体资产表。
2. 先迁移缩略图，再迁移原图。
3. 双读一段时间：自有资源优先，旧 URL 回退。
4. 通过完整率、hash 和页面抽样后结束回退。

### 阶段 3：例句音频

1. 先做单口音、收藏或高频例句。
2. 根据真实播放率决定是否全量生成。
3. 设置独立预算、批次、索引和生命周期策略。

## 14. 实施前需要最终确认的事项

- 音标数据源及其缓存、展示、再分发许可；
- 七牛新 Bucket 的区域、公开/私有模式和自定义域名；
- 美音与英音的具体 Google voice；
- 第一阶段是否只保留每种口音一个主读音，还是立即支持全部次读音；
- 音频使用 MP3，还是在兼容性验证后选择 OGG_OPUS；
- 页面是否对匿名用户开放音频；这会影响防盗链与私有签名方案；
- 图片来源的版权和迁移许可；
- 月度 Google 字符预算、七牛下行流量预算以及超额自动停止阈值。

在这些事项确认前，可以先做数据库 migration 草案和 100 词验证工具，但不应直接启动全量生成。
