const crypto = require("node:crypto");
const prisma = require("../lib/prisma");

// SECRET_KEY_PATTERN 识别对象中可能承载凭据的键名，日志落盘前统一脱敏。
const SECRET_KEY_PATTERN =
  /password|secret|token|cookie|authorization|api[-_]?key/i;

function truncate(value, maximum) {
  const text = String(value ?? "");
  // 未超过上限的文本无需修改，超长文本必须截断以控制日志体积。
  if (text.length <= maximum) {
    return text;
  }
  return `${text.slice(0, maximum)}…`;
}

function sanitize(value, depth = 0, seen = new WeakSet()) {
  if (
    value == null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "string") {
    return truncate(value, 2000);
  }
  if (depth >= 4) {
    return "[maximum-depth]";
  }
  if (typeof value !== "object") {
    return truncate(value, 200);
  }
  if (seen.has(value)) {
    return "[circular]";
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitize(item, depth + 1, seen));
  }
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 100)
      .map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key)
          ? "[redacted]"
          : sanitize(item, depth + 1, seen),
      ]),
  );
}

function requestContext(request) {
  return {
    requestId: request.id || null,
    method: request.method,
    path: truncate(
      (request.originalUrl || request.url || "").split("?")[0],
      1000,
    ),
    userId: Number.isSafeInteger(request.user?.id) ? request.user.id : null,
    vercelId: truncate(request.get?.("x-vercel-id") || "", 255) || null,
    deploymentId: truncate(process.env.VERCEL_DEPLOYMENT_ID || "", 255) || null,
    environment: truncate(
      process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
      32,
    ),
  };
}

function serializeError(error) {
  return {
    name: truncate(error?.name || "Error", 120),
    message: truncate(error?.message || "Unknown error", 8000),
    code: truncate(error?.code || "", 120) || null,
    stack: truncate(error?.stack || "", 32000) || null,
  };
}

function log(level, event, fields = {}) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...sanitize(fields),
  });
  // 错误和致命事件写 stderr，便于托管平台触发告警。
  if (level === "error" || level === "fatal") {
    console.error(payload);
  } else if (level === "warning") {
    console.warn(payload);
  } else {
    console.log(payload);
  }
}

async function persistError(error, request, extra = {}) {
  const context = requestContext(request);
  const serialized = serializeError(error);
  const fingerprint = crypto
    .createHash("sha256")
    .update(
      `${serialized.name}\n${serialized.code || ""}\n${serialized.stack || serialized.message}`,
    )
    .digest("hex");
  try {
    if (!prisma.errorLog || typeof prisma.errorLog.create !== "function") {
      throw new Error("Prisma Client 尚未包含 error_logs 模型");
    }
    return await prisma.errorLog.create({
      data: {
        ...context,
        errorName: serialized.name,
        errorCode: serialized.code,
        message: serialized.message,
        stack: serialized.stack,
        fingerprint,
        context: sanitize(extra),
      },
    });
  } catch (persistenceError) {
    log("error", "error.persistence_failed", {
      ...context,
      originalError: serialized,
      persistenceError: serializeError(persistenceError),
    });
    return null;
  }
}

module.exports = {
  log,
  persistError,
  requestContext,
  sanitize,
  serializeError,
};
