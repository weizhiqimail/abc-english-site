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
    if (response.headersSent) return;
    const normalizedError =
      error instanceof Error
        ? error
        : new Error(String(error || "Unknown error"));
    const databaseErrors = new Set(["P1000", "P1001", "P1003", "P1012"]);
    const databaseConfigured =
      process.env.DATABASE_PROVIDER === "mysql"
        ? process.env.DATABASE_URL
        : process.env.POSTGRES_PRISMA_URL;
    const isJsonSyntaxError =
      normalizedError instanceof SyntaxError &&
      normalizedError.status === 400 &&
      "body" in normalizedError;
    const known =
      normalizedError instanceof AppError
        ? normalizedError.message
        : isJsonSyntaxError
          ? "请求体不是有效的 JSON"
          : normalizedError.code === "P2002"
            ? "数据已存在"
            : databaseErrors.has(normalizedError.code) || !databaseConfigured
              ? "数据库尚未连接，请在 Vercel 中配置 Neon 连接变量并执行数据库初始化"
              : null;
    const status =
      normalizedError instanceof AppError || isJsonSyntaxError
        ? normalizedError.status || 400
        : normalizedError.code === "P2002"
          ? 409
          : 500;
    const context = requestContext(request);
    log(status >= 500 ? "error" : "warning", "http.request.failed", {
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
      known || "服务器内部错误",
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
