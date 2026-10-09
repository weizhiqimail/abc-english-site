const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { tokenMaxAgeMs } = require("../config");

// 数据库只保存 SHA-256 摘要，泄露数据库也无法直接得到浏览器 Cookie 中的令牌。
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
const publicUser = (user) =>
  user && {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    role: user.role,
    createdAt: user.createdAt,
  };

async function login(username, password) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }
  // 使用不可读的随机令牌而不是 JWT，服务端可以随时撤销登录状态。
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + tokenMaxAgeMs);
  await prisma.authToken.create({
    data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
  });
  return { token, expiresAt, user: publicUser(user) };
}

async function authenticate(token) {
  if (!token) {
    return null;
  }
  const authToken = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!authToken) {
    return null;
  }
  if (authToken.expiresAt <= new Date()) {
    await prisma.authToken
      .delete({ where: { id: authToken.id } })
      .catch(() => {});
    return null;
  }
  return publicUser(authToken.user);
}

async function logout(token) {
  if (token) {
    await prisma.authToken.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }
}

module.exports = {
  login,
  authenticate,
  logout,
  publicUser,
  hashPassword: (value) => bcrypt.hash(value, 12),
};
