const express = require("express");
const vocabulary = require("../services/vocabularyService");
const { ok, fail } = require("../utils/response");
const asyncRoute = require("../utils/asyncRoute");
const { optionalString, requiredString } = require("../utils/validation");
const { assertMethods } = require("../utils/contracts");

assertMethods(vocabulary, "vocabularyService", [
  "normalizeLevel",
  "getOverview",
  "listCategories",
  "getCategory",
  "search",
]);

const router = express.Router();

router.get(
  "/overview",
  asyncRoute(async (_request, response) =>
    ok(response, await vocabulary.getOverview()),
  ),
);

router.get(
  "/vocabulary/categories",
  asyncRoute(async (request, response) => {
    const rawLevel = optionalString(request.query.level, {
      label: "等级",
      maxLength: 2,
    });
    const level = rawLevel ? vocabulary.normalizeLevel(rawLevel) : null;
    if (rawLevel && !level) {
      return fail(response, 400, "等级必须是 A1、A2、B1、B2、C1 或 C2");
    }
    ok(
      response,
      await vocabulary.listCategories({
        level,
        query: optionalString(request.query.q, {
          label: "搜索词",
          allowEmpty: true,
          maxLength: 100,
        }),
      }),
    );
  }),
);

router.get(
  "/vocabulary/levels/:level",
  asyncRoute(async (request, response) => {
    const rawLevel = requiredString(request.params.level, {
      label: "等级",
      maxLength: 2,
    });
    const level = vocabulary.normalizeLevel(rawLevel);
    if (!level) {
      return fail(response, 400, "无效等级");
    }
    const overview = (await vocabulary.getOverview()).levels.find(
      (item) => item.level === level,
    );
    ok(response, {
      ...overview,
      categories: await vocabulary.listCategories({
        level,
        query: optionalString(request.query.q, {
          label: "搜索词",
          allowEmpty: true,
          maxLength: 100,
        }),
      }),
    });
  }),
);

router.get(
  "/vocabulary/categories/:recordId",
  asyncRoute(async (request, response) => {
    const recordId = requiredString(request.params.recordId, {
      label: "分类 ID",
      maxLength: 64,
      pattern: /^[A-Za-z0-9._:-]+$/,
      patternMessage: "分类 ID 格式错误",
    });
    const page = await vocabulary.getCategory(recordId);
    if (!page) {
      return fail(response, 404, "分类不存在");
    }
    ok(response, page);
  }),
);

router.get(
  "/search",
  asyncRoute(async (request, response) => {
    const query =
      optionalString(request.query.q, {
        label: "搜索词",
        allowEmpty: true,
        maxLength: 100,
      }) || "";
    if (query.length < 1) {
      return ok(response, { categories: [], words: [] });
    }
    ok(response, await vocabulary.search(query));
  }),
);

module.exports = router;
