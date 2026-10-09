const { PrismaClient } = require("../../generated/postgres-client");

const prisma = global.__abcEnglishPrisma || new PrismaClient();
// 开发环境复用实例，避免热更新反复创建数据库连接池。
if (process.env.NODE_ENV !== "production") {
  global.__abcEnglishPrisma = prisma;
}

module.exports = prisma;
