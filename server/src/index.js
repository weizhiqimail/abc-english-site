const createApp = require("./app");
const { port } = require("./config");

// 本地服务也统一读取 Vercel 环境变量，避免缺少数据库连接时延迟到请求阶段才报错。
const requiredDatabaseUrl = "POSTGRES_PRISMA_URL";

if (!process.env[requiredDatabaseUrl]) {
  console.error(
    `启动失败：缺少 Vercel 环境变量 ${requiredDatabaseUrl}。请通过 npm run site:server:dev 启动服务。`,
  );
  process.exitCode = 1;
} else {
  createApp().listen(port, "127.0.0.1", () => {
    console.log(`ABC English: http://127.0.0.1:${port}`);
  });
}
