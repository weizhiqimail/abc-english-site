require("dotenv").config();

const baseUrl = process.env.SITE_TEST_URL || "http://127.0.0.1:3211";
const temporaryName = `site_test_${Date.now()}`;
let adminCookie = "";
let temporaryUserId = null;
let temporaryCollectionId = null;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = await response.json();
  return {
    response,
    payload,
    cookie: response.headers.getSetCookie()[0]?.split(";")[0] || "",
  };
}

async function expect(path, status, options) {
  const result = await request(path, options);
  assert(
    result.response.status === status,
    `${options?.method || "GET"} ${path}: 预期 ${status}，实际 ${result.response.status}（${result.payload.error || "无错误信息"}）`,
  );
  return result;
}

async function main() {
  const overview = await expect("/api/overview", 200);
  assert(overview.payload.data.levels.length === 6, "概览必须返回六个等级");

  const a1 = await expect("/api/vocabulary/levels/a1", 200);
  assert(a1.payload.data.categories.length > 0, "A1 应包含主题");
  const c1 = await expect("/api/vocabulary/levels/c1", 200);
  assert(c1.payload.data.categories.length === 0, "C1 应返回正常空数据");
  await expect("/api/vocabulary/levels/x1", 400);
  await expect("/api/vocabulary/categories?level=A1", 200);
  await expect("/api/vocabulary/categories?level=X1", 400);

  const recordId = a1.payload.data.categories[0].recordId;
  const detail = await expect(`/api/vocabulary/categories/${recordId}`, 200);
  assert(detail.payload.data.cards.length > 0, "主题详情应包含词汇");
  await expect("/api/vocabulary/categories/not-found", 404);
  await expect("/api/search?q=family", 200);
  await expect("/api/search", 200);

  const anonymousMe = await expect("/api/auth/me", 200);
  assert(anonymousMe.payload.data.user === null, "匿名状态不应包含用户");
  await expect("/api/collections", 401);
  await expect("/api/admin/users", 401);
  await expect("/api/auth/login", 401, {
    method: "POST",
    body: { username: "invalid", password: "invalid" },
  });

  const login = await expect("/api/auth/login", 200, {
    method: "POST",
    body: {
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  adminCookie = login.cookie;
  assert(adminCookie, "登录响应必须设置认证 Cookie");

  const me = await expect("/api/auth/me", 200, { cookie: adminCookie });
  assert(me.payload.data.user.role === "admin", "管理员角色错误");
  const collections = await expect("/api/collections", 200, {
    cookie: adminCookie,
  });
  const defaultCollection = collections.payload.data.find(
    (item) => item.isDefault,
  );
  assert(defaultCollection, "管理员必须有默认收藏夹");

  const createdCollection = await expect("/api/collections", 201, {
    method: "POST",
    cookie: adminCookie,
    body: { name: temporaryName },
  });
  temporaryCollectionId = createdCollection.payload.data.id;
  await expect(`/api/collections/${temporaryCollectionId}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: { name: `${temporaryName}_renamed` },
  });

  const card = detail.payload.data.cards[0];
  const wordKey =
    card.wordEntryId == null
      ? `translation:${card.translationId}`
      : String(card.wordEntryId);
  await expect(`/api/collections/${temporaryCollectionId}/favorites`, 201, {
    method: "POST",
    cookie: adminCookie,
    body: { recordId, wordKey },
  });
  const withFavorite = await expect("/api/collections", 200, {
    cookie: adminCookie,
  });
  const testedCollection = withFavorite.payload.data.find(
    (item) => item.id === temporaryCollectionId,
  );
  assert(testedCollection?._count.favorites === 1, "收藏数量没有更新");
  await expect(
    `/api/collections/${temporaryCollectionId}/favorites/${encodeURIComponent(wordKey)}`,
    200,
    { method: "DELETE", cookie: adminCookie },
  );

  const createdUser = await expect("/api/admin/users", 201, {
    method: "POST",
    cookie: adminCookie,
    body: {
      username: temporaryName,
      nickname: "测试用户",
      password: "temporary-password-1",
    },
  });
  temporaryUserId = createdUser.payload.data.id;
  await expect(`/api/admin/users/${temporaryUserId}`, 200, {
    method: "PATCH",
    cookie: adminCookie,
    body: { nickname: "已更新测试用户", password: "temporary-password-2" },
  });
  await expect("/api/admin/users", 200, { cookie: adminCookie });

  const userLogin = await expect("/api/auth/login", 200, {
    method: "POST",
    body: { username: temporaryName, password: "temporary-password-2" },
  });
  await expect("/api/admin/users", 403, { cookie: userLogin.cookie });
  const userCollections = await expect("/api/collections", 200, {
    cookie: userLogin.cookie,
  });
  assert(
    userCollections.payload.data.some((item) => item.isDefault),
    "新用户必须有默认收藏夹",
  );
  await expect("/api/auth/logout", 200, {
    method: "POST",
    cookie: userLogin.cookie,
    body: {},
  });

  console.log("站点 API 冒烟测试通过。");
}

async function cleanup() {
  if (temporaryCollectionId) {
    await request(`/api/collections/${temporaryCollectionId}`, {
      method: "DELETE",
      cookie: adminCookie,
    }).catch(() => {});
  }
  if (temporaryUserId) {
    await request(`/api/admin/users/${temporaryUserId}`, {
      method: "DELETE",
      cookie: adminCookie,
    }).catch(() => {});
  }
  if (adminCookie) {
    await request("/api/auth/logout", {
      method: "POST",
      cookie: adminCookie,
      body: {},
    }).catch(() => {});
  }
}

main()
  .catch((error) => {
    console.error(`站点 API 冒烟测试失败：${error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
