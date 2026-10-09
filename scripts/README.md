# scripts 服务说明

`scripts` 存放网站的可公开辅助服务。线上业务数据由 Postgres 提供，本目录不保存网站正文或内部工作记录。

| 目录          | 作用                               | 常用命令                               |
| ------------- | ---------------------------------- | -------------------------------------- |
| `lexicon-hub` | 仅绑定本机的词汇管理和批量任务界面 | `npm run lexicon:dev`                  |
| `phonetic`    | IPA 音标解析与规范化模块           | 由 Node API 调用                       |
| `qiniu`       | 对象存储上传模块                   | `npm run qiniu:upload -- <key> <file>` |
| `tts`         | Google TTS 发音合成模块            | 由 Node API 调用                       |

## 本地维护工作区

需要本地维护文件的功能统一通过 `ABC_ENGLISH_PRIVATE_ROOT` 定位独立工作区。Lexicon Hub 默认使用 `D:\program\abc-english-site-private`，也可以通过环境变量覆盖。公开项目只保存路径配置，不复制或生成该工作区内容。

新增脚本时应遵守以下规则：

- 凭据只从环境变量读取，不写入源码、README 或日志。
- 生成文件写入已忽略的输出目录，提交前使用 `git status --short` 检查。
- 需要本地维护文件的任务只能从 `privateWorkspaceRoot` 或 `privateScriptsRoot` 派生路径。
- 面向浏览器的业务数据必须通过服务端 API 和 Postgres 获取。
