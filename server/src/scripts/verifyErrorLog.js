const prisma = require("../lib/prisma");

async function main() {
  if (!prisma.errorLog || typeof prisma.errorLog.count !== "function") {
    throw new Error("Prisma Client 缺少 errorLog delegate");
  }
  const count = await prisma.errorLog.count();
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("error_logs 返回了无效记录数");
  }
  console.log(`error_logs 表可用，当前记录数：${count}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
