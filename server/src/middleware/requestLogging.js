const crypto = require("node:crypto");
const { log, requestContext } = require("../services/errorLogService");

// REQUEST_ID_PATTERN 只接受适合作为日志关联 ID 的短 ASCII 字符，防止控制字符和超长值污染日志。
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

// resolveRequestId 仅复用格式安全的上游 ID，否则生成服务端可信的新 ID。
function resolveRequestId(incomingId) {
  if (typeof incomingId === "string" && REQUEST_ID_PATTERN.test(incomingId)) {
    return incomingId;
  }
  return crypto.randomUUID();
}

// resolveLogLevel 按 HTTP 状态码确定日志严重程度，避免嵌套三元掩盖优先级。
function resolveLogLevel(statusCode) {
  // 5xx 表示服务端故障，需要错误级别告警。
  if (statusCode >= 500) {
    return "error";
  }
  // 4xx 是可预期的请求问题，使用警告级别保留排查线索。
  if (statusCode >= 400) {
    return "warning";
  }
  return "info";
}

// requestLogging 为每个请求注入关联 ID，并在响应完成后写入结构化访问日志。
function requestLogging(request, response, next) {
  const incomingId = request.get("x-request-id");
  request.id = resolveRequestId(incomingId);
  response.setHeader("x-request-id", request.id);
  const startedAt = process.hrtime.bigint();
  response.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = resolveLogLevel(response.statusCode);
    log(level, "http.request.completed", {
      ...requestContext(request),
      statusCode: response.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      contentLength: response.getHeader("content-length") || null,
    });
  });
  next();
}

module.exports = requestLogging;
