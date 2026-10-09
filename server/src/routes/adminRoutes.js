const express = require("express");
const prisma = require("../lib/prisma");
const authService = require("../services/authService");
const { requireAdmin } = require("../middleware/auth");
const { ok, fail } = require("../utils/response");
const asyncRoute = require("../utils/asyncRoute");

const router = express.Router();
router.use(requireAdmin);

const selectUser = {
  id: true,
  username: true,
  nickname: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

// 数据库浏览只开放已知业务表，避免管理员通过 URL 构造任意模型查询。
const databaseTables = [
  { key: "users", label: "用户", delegate: "user", orderBy: { id: "asc" } },
  {
    key: "auth_tokens",
    label: "登录令牌",
    delegate: "authToken",
    orderBy: { id: "asc" },
  },
  {
    key: "collections",
    label: "收藏夹",
    delegate: "collection",
    orderBy: { id: "asc" },
  },
  {
    key: "favorites",
    label: "收藏词条",
    delegate: "favorite",
    orderBy: { id: "asc" },
  },
  {
    key: "vocabulary_categories",
    label: "词汇分类",
    delegate: "vocabularyCategory",
    orderBy: { recordId: "asc" },
  },
  {
    key: "vocabulary_words",
    label: "词汇",
    delegate: "vocabularyWord",
    orderBy: { id: "asc" },
  },
  {
    key: "vocabulary_examples",
    label: "例句",
    delegate: "vocabularyExample",
    orderBy: { id: "asc" },
  },
];

function availableDatabaseTables() {
  // 本地旧数据库可能只有用户相关表，因此按当前 Prisma Client 能力动态筛选。
  return databaseTables.filter((table) => prisma[table.delegate]);
}

function sanitizeDatabaseRow(row) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      if (key === "passwordHash" || key === "tokenHash") {
        return [key, "[敏感信息已隐藏]"];
      }
      return [key, value];
    }),
  );
}

router.get(
  "/database",
  asyncRoute(async (_request, response) => {
    const tables = await Promise.all(
      availableDatabaseTables().map(async (table) => ({
        key: table.key,
        name: table.key,
        label: table.label,
        count: await prisma[table.delegate].count(),
      })),
    );
    ok(response, { tableCount: tables.length, tables });
  }),
);

router.get(
  "/database/:tableKey",
  asyncRoute(async (request, response) => {
    const table = availableDatabaseTables().find(
      (item) => item.key === request.params.tableKey,
    );
    if (!table) {
      return fail(response, 404, "数据表不存在");
    }

    const page = Math.max(1, Number(request.query.page) || 1);
    const pageSize = Math.min(
      100,
      Math.max(10, Number(request.query.pageSize) || 25),
    );
    const [total, rows] = await Promise.all([
      prisma[table.delegate].count(),
      prisma[table.delegate].findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: table.orderBy,
      }),
    ]);
    ok(response, {
      table: { key: table.key, name: table.key, label: table.label },
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      rows: rows.map(sanitizeDatabaseRow),
    });
  }),
);

router.get(
  "/users",
  asyncRoute(async (_request, response) => {
    ok(
      response,
      await prisma.user.findMany({
        select: selectUser,
        orderBy: { createdAt: "desc" },
      }),
    );
  }),
);

router.post(
  "/users",
  asyncRoute(async (request, response) => {
    const username = String(request.body?.username || "").trim();
    const password = String(request.body?.password || "");
    const nickname =
      String(request.body?.nickname || username).trim() || username;
    if (username.length < 3 || password.length < 8) {
      return fail(response, 400, "用户名至少 3 位，密码至少 8 位");
    }
    const exists = await prisma.user.findUnique({ where: { username } });
    if (exists) {
      return fail(response, 409, "用户名已存在");
    }
    // 页面创建的账号固定为普通用户，管理员只能通过受控初始化命令创建。
    const user = await prisma.user.create({
      data: {
        username,
        nickname,
        role: "user",
        passwordHash: await authService.hashPassword(password),
        collections: { create: { name: "默认收藏夹", isDefault: true } },
      },
      select: selectUser,
    });
    ok(response, user, 201);
  }),
);

router.patch(
  "/users/:id",
  asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return fail(response, 404, "用户不存在");
    }
    if (
      existing.role === "admin" &&
      request.body.username &&
      request.body.username !== existing.username
    ) {
      return fail(response, 400, "管理员用户名不能在用户管理页面修改");
    }
    const data = {};
    if (request.body.nickname !== undefined) {
      data.nickname = String(request.body.nickname).trim() || existing.username;
    }
    if (request.body.username !== undefined && existing.role !== "admin") {
      const username = String(request.body.username).trim();
      if (username.length < 3) {
        return fail(response, 400, "用户名至少 3 位");
      }
      data.username = username;
    }
    if (request.body.password) {
      if (String(request.body.password).length < 8) {
        return fail(response, 400, "密码至少 8 位");
      }
      data.passwordHash = await authService.hashPassword(
        String(request.body.password),
      );
    }
    const user = await prisma.user.update({
      where: { id },
      data,
      select: selectUser,
    });
    if (request.body.password) {
      await prisma.authToken.deleteMany({ where: { userId: id } });
    }
    ok(response, user);
  }),
);

router.delete(
  "/users/:id",
  asyncRoute(async (request, response) => {
    const id = Number(request.params.id);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return fail(response, 404, "用户不存在");
    }
    // 管理员承担系统维护职责，不能从用户管理页面删除。
    if (existing.role === "admin") {
      return fail(response, 400, "管理员账号不可删除");
    }
    await prisma.user.delete({ where: { id } });
    ok(response, { deleted: true });
  }),
);

module.exports = router;
