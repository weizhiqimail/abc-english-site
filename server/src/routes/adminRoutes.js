const express = require("express");
const prisma = require("../lib/prisma");
const authService = require("../services/authService");
const { requireAdmin } = require("../middleware/auth");
const { ok, fail } = require("../utils/response");
const asyncRoute = require("../utils/asyncRoute");
const {
  assertAllowedKeys,
  boundedInteger,
  optionalString,
  positiveInteger,
  requirePlainObject,
  requiredString,
  USERNAME_PATTERN,
} = require("../utils/validation");

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
    key: "error_logs",
    label: "服务错误日志",
    delegate: "errorLog",
    orderBy: { createdAt: "desc" },
  },
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
      if (typeof value === "bigint") {
        return [key, value.toString()];
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

    const page = boundedInteger(request.query.page, {
      label: "页码",
      defaultValue: 1,
      max: 1_000_000,
    });
    const pageSize = boundedInteger(request.query.pageSize, {
      label: "每页数量",
      defaultValue: 25,
      min: 10,
      max: 100,
    });
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
    const body = requirePlainObject(request.body);
    assertAllowedKeys(body, ["username", "password", "nickname"]);
    const username = requiredString(body.username, {
      label: "用户名",
      minLength: 3,
      maxLength: 80,
      pattern: USERNAME_PATTERN,
      patternMessage: "用户名只能包含字母、数字及 . _ @ -",
    });
    const password = requiredString(body.password, {
      label: "密码",
      trim: false,
      minLength: 8,
      maxLength: 255,
    });
    const nickname =
      optionalString(body.nickname, {
        label: "昵称",
        maxLength: 100,
      }) || username;
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
    const id = positiveInteger(request.params.id, "用户 ID");
    const body = requirePlainObject(request.body);
    assertAllowedKeys(body, ["username", "password", "nickname"]);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return fail(response, 404, "用户不存在");
    }
    if (
      existing.role === "admin" &&
      body.username &&
      body.username !== existing.username
    ) {
      return fail(response, 400, "管理员用户名不能在用户管理页面修改");
    }
    const data = {};
    if (body.nickname !== undefined) {
      data.nickname =
        optionalString(body.nickname, {
          label: "昵称",
          allowEmpty: true,
          maxLength: 100,
        }) || existing.username;
    }
    if (body.username !== undefined && existing.role !== "admin") {
      const username = requiredString(body.username, {
        label: "用户名",
        minLength: 3,
        maxLength: 80,
        pattern: USERNAME_PATTERN,
        patternMessage: "用户名只能包含字母、数字及 . _ @ -",
      });
      data.username = username;
    }
    if (body.password !== undefined) {
      const password = requiredString(body.password, {
        label: "密码",
        trim: false,
        minLength: 8,
        maxLength: 255,
      });
      data.passwordHash = await authService.hashPassword(password);
    }
    const user = await prisma.user.update({
      where: { id },
      data,
      select: selectUser,
    });
    if (body.password !== undefined) {
      await prisma.authToken.deleteMany({ where: { userId: id } });
    }
    ok(response, user);
  }),
);

router.delete(
  "/users/:id",
  asyncRoute(async (request, response) => {
    const id = positiveInteger(request.params.id, "用户 ID");
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
