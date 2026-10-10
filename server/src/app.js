const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const { webDistDir, isProduction } = require("./config");
const { optionalAuth } = require("./middleware/auth");
const vocabularyRoutes = require("./routes/vocabularyRoutes");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const collectionRoutes = require("./routes/collectionRoutes");
const requestLogging = require("./middleware/requestLogging");
const {
  sameOriginMutations,
  securityHeaders,
} = require("./middleware/security");
const { AppError } = require("./utils/errors");
const { fail } = require("./utils/response");
const {
  log,
  persistError,
  requestContext,
  serializeError,
} = require("./services/errorLogService");

// DATABASE_CONNECTION_ERROR_CODES 是 Prisma 明确表示数据库配置或连接失败的错误码。
const DATABASE_CONNECTION_ERROR_CODES = new Set([
  "P1000",
  "P1001",
  "P1003",
  "P1012",
]);

// normalizeError 保证错误处理中间件始终处理标准 Error 实例。
function normalizeError(error) {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error || "Unknown error"));
}

// isInvalidJsonError 识别 Express 解析 JSON 请求体时产生的语法错误。
function isInvalidJsonError(error) {
  return (
    error instanceof SyntaxError && error.status === 400 && "body" in error
  );
}

// resolvePublicError 将内部错误映射为可安全展示给客户端的信息。
function resolvePublicError(error, invalidJson) {
  // 业务错误已经包含经过设计的公开消息，应原样返回。
  if (error instanceof AppError) {
    return error.message;
  }
  if (invalidJson) {
    return "请求体不是有效的 JSON";
  }
  if (error.code === "P2002") {
    return "数据已存在";
  }
  const databaseConfigured = Boolean(process.env.POSTGRES_PRISMA_URL);
  if (DATABASE_CONNECTION_ERROR_CODES.has(error.code) || !databaseConfigured) {
    return "数据库尚未连接，请在 Vercel 中配置 Neon 连接变量并执行数据库初始化";
  }
  return null;
}

// resolveStatusCode 按错误类别返回稳定的 HTTP 状态码。
function resolveStatusCode(error, invalidJson) {
  if (error instanceof AppError || invalidJson) {
    return error.status || 400;
  }
  if (error.code === "P2002") {
    return 409;
  }
  return 500;
}

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(requestLogging);
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use("/api", sameOriginMutations);
  app.use(optionalAuth);
  app.use("/api", vocabularyRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", collectionRoutes);

  app.use("/api/{*path}", (request, response) =>
    fail(response, 404, "API 接口不存在", "API_NOT_FOUND"),
  );

  app.use(async (error, request, response, _next) => {
    // 响应已经开始发送时不能再次写入响应体，只能交给底层连接收尾。
    if (response.headersSent) {
      return;
    }
    const normalizedError = normalizeError(error);
    const invalidJson = isInvalidJsonError(normalizedError);
    const publicError = resolvePublicError(normalizedError, invalidJson);
    const status = resolveStatusCode(normalizedError, invalidJson);
    const context = requestContext(request);
    // 服务器错误需要错误级日志；客户端请求问题保留为警告即可。
    const logLevel = status >= 500 ? "error" : "warning";
    log(logLevel, "http.request.failed", {
      ...context,
      statusCode: status,
      error: serializeError(normalizedError),
    });
    if (status >= 500) {
      await persistError(normalizedError, request, { statusCode: status });
    }
    fail(
      response,
      status,
      publicError || "服务器内部错误",
      normalizedError instanceof AppError ? normalizedError.code : null,
    );
  });

  if (fs.existsSync(webDistDir)) {
    app.use(express.static(webDistDir, { index: false }));
    // React Router 使用 history 模式，所有非 API 地址都返回同一份前端入口。
    app.get("/{*path}", (request, response, next) => {
      if (request.path.startsWith("/api")) {
        return next();
      }
      response.sendFile(path.join(webDistDir, "index.html"));
    });
  } else if (isProduction) {
    console.warn(`前端构建目录不存在: ${webDistDir}`);
  }
  return app;
}

module.exports = createApp;
