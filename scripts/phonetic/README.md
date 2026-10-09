# 音标服务

音标与 TTS 完全分离。此模块只读取已合法取得、允许缓存和展示的结构化来源，并保留 `sourceProvider`、版本和许可等原始字段。不要用 Google TTS 或大模型反推 IPA。

## 输入文件格式

支持 JSON 数组或每行一条记录的 JSONL。最小示例：

```json
{
  "word": "hello",
  "locale": "en-US",
  "ipa": "həˈloʊ",
  "partOfSpeech": "interjection",
  "sourceProvider": "wiktextract",
  "sourceVersion": "2026-09",
  "sourceLicense": "CC BY-SA"
}
```

## 调用示例

```js
const {
  createJsonPhoneticProvider,
  createPhoneticResolver,
} = require("./scripts/phonetic");

const service = createPhoneticResolver({
  providers: [
    createJsonPhoneticProvider({
      name: "wiktextract",
      filePath: "data/wiktionary.jsonl",
    }),
  ],
});
const one = await service.resolveOne({ word: "hello", locale: "en-US" });
const many = await service.resolveMany([{ word: "hello" }, { word: "world" }]);
```

多个 provider 会并行查询并合并候选；单个来源故障会进入 `warnings`，不会吞掉其他来源结果。

Lexicon Hub 中通过系统路径分隔符配置多个文件：

```powershell
$env:PHONETIC_DATA_FILES="D:\data\us.jsonl;D:\data\uk.jsonl"
npm run lexicon:dev
```

运行测试：

```bash
node --test scripts/phonetic/tests/*.test.js
```
