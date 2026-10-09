const prisma = require("../lib/prisma");
const { hashPassword } = require("../services/authService");

async function main() {
  const username = String(process.env.ADMIN_USERNAME || "").trim();
  const password = String(process.env.ADMIN_PASSWORD || "");
  if (!username || password.length < 12) {
    throw new Error(
      "请在 Vercel 环境变量中设置 ADMIN_USERNAME 和至少 12 位的 ADMIN_PASSWORD",
    );
  }
  const existingAdmin = await prisma.user.findFirst({
    where: { role: "admin" },
  });
  if (existingAdmin) {
    // 环境变量是管理员凭据的唯一来源，重复执行时同步账号而不是静默跳过。
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        username,
        nickname: existingAdmin.nickname || username,
        passwordHash: await hashPassword(password),
      },
    });
    const defaultCollection = await prisma.collection.findFirst({
      where: { userId: existingAdmin.id, isDefault: true },
    });
    if (!defaultCollection) {
      await prisma.collection.create({
        data: {
          userId: existingAdmin.id,
          name: "默认收藏夹",
          isDefault: true,
        },
      });
    }
    // 修改密码后撤销旧令牌，避免旧会话继续持有管理员权限。
    await prisma.authToken.deleteMany({ where: { userId: existingAdmin.id } });
    console.log("管理员账号已同步。");
    return;
  }
  await prisma.user.create({
    data: {
      username,
      nickname: username,
      role: "admin",
      passwordHash: await hashPassword(password),
      collections: { create: { name: "默认收藏夹", isDefault: true } },
    },
  });
  console.log("初始管理员创建成功。");
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
