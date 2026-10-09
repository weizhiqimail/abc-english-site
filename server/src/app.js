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

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(optionalAuth);
  app.use("/api", vocabularyRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api", collectionRoutes);

  app.use((error, _request, response, _next) => {
    console.error(error);
    const databaseErrors = new Set(["P1000", "P1001", "P1003", "P1012"]);
    const databaseConfigured =
      process.env.DATABASE_PROVIDER === "mysql"
        ? process.env.DATABASE_URL
        : process.env.POSTGRES_PRISMA_URL;
    const known =
      error.code === "P2002"
        ? "数据已存在"
        : databaseErrors.has(error.code) || !databaseConfigured
          ? "数据库尚未连接，请在 Vercel 中配置 Neon 连接变量并执行数据库初始化"
          : null;
    response
      .status(known ? 409 : 500)
      .json({ success: false, data: null, error: known || "服务器内部错误" });
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
