const fs = require("node:fs");
const path = require("node:path");

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ENTRY_BYTES = 256 * 1024;
const REDACTED = "[REDACTED]";
const secretKeyPattern =
  /authorization|cookie|password|secret|token|credential|access.?key|private.?key/i;

function sanitize(value, key = "", seen = new WeakSet()) {
  if (secretKeyPattern.test(key)) return REDACTED;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Buffer.isBuffer(value)) {
    return { type: "Buffer", byteLength: value.length };
  }
  if (typeof value === "string") {
    return value.length > 8_000
      ? `${value.slice(0, 8_000)}…[truncated]`
      : value;
  }
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 500).map((item) => sanitize(item, key, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([childKey, childValue]) => [
      childKey,
      sanitize(childValue, childKey, seen),
    ]),
  );
}

function datePart(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function describeEvent(event) {
  const operationDescriptions = {
    "application.starting": "正在读取配置并初始化数据库、七牛和 TTS 依赖。",
    "application.started": "服务已经监听指定地址，可以接收请求。",
    "application.start-failed": "服务初始化失败，未能进入可用状态。",
    "application.stopping": "正在停止 HTTP 服务并释放数据库连接。",
    "application.stopped": "服务和数据库连接均已安全关闭。",
    "http.request.started": "收到 HTTP 请求，正在根据路由和请求参数处理。",
    "http.request.completed": "HTTP 请求处理完成，响应已经发送。",
    "http.request.failed": "HTTP 请求处理失败，即将返回错误响应。",
    "postgres.words.query.started": "正在按等级、分类和筛选条件查询词汇。",
    "postgres.words.query.completed":
      "词汇查询完成，已返回匹配的数据和统计数量。",
    "postgres.image-status.updating": "正在把词汇图片状态更新为上传中。",
    "postgres.image-status.published":
      "七牛上传已确认，图片地址和对象 key 已发布到数据库。",
    "postgres.image-status.failed": "图片任务失败原因已经写入数据库。",
    "image.batch.started": "开始批量处理用户选中的全部词汇图片。",
    "image.batch.completed": "批量图片任务结束，正在汇总成功、失败和逐项结果。",
    "image.migration.started": "开始处理单个词汇的图片迁移。",
    "image.migration.completed": "单个词汇图片已上传并完成数据库发布。",
    "image.migration.failed":
      "词汇图片迁移失败，错误原因将写入数据库以便重试。",
    "image.download.started": "正在从白名单来源下载词汇原始图片。",
    "image.download.completed": "原图下载和类型、大小校验已经完成。",
    "qiniu.public-domain.resolved":
      "已取得用于拼接公开资源地址的七牛访问域名。",
    "qiniu.image-upload.started": "正在向七牛上传词汇图片对象。",
    "qiniu.image-upload.completed": "七牛图片上传成功并返回对象信息。",
    "qiniu.audio-upload.started": "正在向七牛上传发音音频对象。",
    "qiniu.audio-upload.completed": "七牛音频上传成功并返回对象信息。",
    "google-tts.synthesis.started": "正在调用 Google Cloud TTS 合成发音音频。",
    "google-tts.synthesis.completed":
      "Google Cloud TTS 已返回音频和合成元数据。",
    "phonetic.resolve.started": "正在按词形和词性查找可用音标。",
    "phonetic.resolve.completed": "音标查找完成，已取得候选结果。",
    "enrichment.started": "开始为单个词汇补全音标和发音资源。",
    "enrichment.completed": "词汇音标和发音资源补全完成。",
    "local-task.queued": "本地批量任务已创建，正在等待事件循环调度。",
    "local-task.started": "本地批量任务开始执行。",
    "local-task.progress": "任务完成一个词汇处理步骤，正在推送最新进度。",
    "local-task.completed": "本地批量任务全部执行完毕。",
    "local-task.failed": "本地批量任务因未处理异常而终止。",
  };
  const taskRules = [
    ["http.", "HTTP 请求"],
    ["application.", "Lexicon Hub 服务"],
    ["postgres.", "PostgreSQL 数据操作"],
    ["image.download.", "原始图片下载"],
    ["image.batch.", "批量图片迁移"],
    ["image.migration.", "词汇图片迁移"],
    ["qiniu.image-upload.", "七牛图片上传"],
    ["qiniu.audio-upload.", "七牛发音上传"],
    ["qiniu.public-domain.", "七牛访问域名解析"],
    ["google-tts.", "Google Cloud TTS"],
    ["phonetic.", "音标解析"],
    ["enrichment.", "词汇发音补全"],
    ["api.", "API 任务调用"],
    ["operations.", "批量操作页面"],
    ["local-task.", "本地批量任务"],
  ];
  const task =
    taskRules.find(([prefix]) => event.startsWith(prefix))?.[1] ||
    "Lexicon Hub 任务";
  const status =
    event.endsWith(".started") || event.endsWith(".requested")
      ? "开始"
      : event.endsWith(".completed") ||
          event.endsWith(".succeeded") ||
          event.endsWith(".published") ||
          event.endsWith(".updated") ||
          event.endsWith(".saved") ||
          event.endsWith(".resolved") ||
          event.endsWith(".loaded")
        ? "成功"
        : event.endsWith(".failed") || event.endsWith(".failing")
          ? "失败"
          : event.endsWith(".skipped")
            ? "跳过"
            : event.endsWith(".stopping")
              ? "停止中"
              : "执行中";
  return {
    task,
    status,
    description: operationDescriptions[event] || `正在处理内部事件：${event}。`,
  };
}

function formatLogRecord(record) {
  const { task, status, description } = describeEvent(record.event);
  const details = { ...record };
  delete details.timestamp;
  delete details.localTime;
  delete details.level;
  delete details.event;
  const duration = Number.isFinite(details.durationMs)
    ? `${details.durationMs.toFixed(2)} ms`
    : "未完成或未统计";
  const progress =
    Number.isFinite(details.count) || Number.isFinite(details.succeeded)
      ? `总数=${details.count ?? "未知"}，成功=${details.succeeded ?? "进行中"}，失败=${details.failed ?? "进行中"}`
      : "当前事件未提供批量进度";
  return [
    "================================================================================",
    `时间：${record.localTime || record.timestamp}（ISO：${record.timestamp}）`,
    `级别：${record.level.toUpperCase()}`,
    `任务：${task}`,
    `状态：${status}`,
    `执行内容：${description}`,
    `内部事件：${record.event}`,
    `耗时：${duration}`,
    `进度：${progress}`,
    "参数、结果及相关信息：",
    JSON.stringify(details, null, 2),
    "",
  ].join("\n");
}

function createLogger(options = {}) {
  const logDirectory =
    options.logDirectory || path.resolve(__dirname, "../../logs");
  const baseContext = options.context || {};
  let activeDate = "";
  let activeIndex = 0;
  let activePath = "";
  fs.mkdirSync(logDirectory, { recursive: true });

  function selectFile(day, entryBytes) {
    if (activeDate !== day) {
      activeDate = day;
      activeIndex = 1;
      while (
        fs.existsSync(
          path.join(
            logDirectory,
            `${day}-${String(activeIndex).padStart(5, "0")}.log`,
          ),
        )
      ) {
        activeIndex += 1;
      }
      activeIndex = Math.max(1, activeIndex - 1);
      activePath = path.join(
        logDirectory,
        `${day}-${String(activeIndex).padStart(5, "0")}.log`,
      );
      // 旧版本是纯 JSON 行；格式升级后从新分片开始，避免同一文件混合两种格式。
      if (
        fs.existsSync(activePath) &&
        fs.readFileSync(activePath, "utf8").trimStart().startsWith("{")
      ) {
        activeIndex += 1;
        activePath = path.join(
          logDirectory,
          `${day}-${String(activeIndex).padStart(5, "0")}.log`,
        );
      }
    }
    const currentBytes = fs.existsSync(activePath)
      ? fs.statSync(activePath).size
      : 0;
    if (currentBytes > 0 && currentBytes + entryBytes > MAX_FILE_BYTES) {
      activeIndex += 1;
      activePath = path.join(
        logDirectory,
        `${day}-${String(activeIndex).padStart(5, "0")}.log`,
      );
    }
    return activePath;
  }

  function write(level, event, details = {}) {
    const now = new Date();
    const record = sanitize({
      timestamp: now.toISOString(),
      localTime: now.toLocaleString("zh-CN", { hour12: false }),
      level,
      event,
      ...baseContext,
      ...details,
    });
    let line = formatLogRecord(record);
    if (Buffer.byteLength(line) > MAX_ENTRY_BYTES) {
      const truncatedRecord = {
        timestamp: record.timestamp,
        level,
        event,
        ...baseContext,
        detailsTruncated: true,
        preview: line.slice(0, 200_000),
      };
      line = formatLogRecord(truncatedRecord);
    }
    const bytes = Buffer.byteLength(line);
    fs.appendFileSync(selectFile(datePart(now), bytes), line, "utf8");
  }

  return {
    debug: (event, details) => write("debug", event, details),
    error: (event, details) => write("error", event, details),
    info: (event, details) => write("info", event, details),
    warn: (event, details) => write("warn", event, details),
    child(context) {
      return createLogger({
        logDirectory,
        context: { ...baseContext, ...context },
      });
    },
  };
}

module.exports = {
  MAX_FILE_BYTES,
  createLogger,
  describeEvent,
  formatLogRecord,
  sanitize,
};
