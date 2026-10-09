const express = require("express");
const vocabulary = require("../services/vocabularyService");
const { ok, fail } = require("../utils/response");
const asyncRoute = require("../utils/asyncRoute");

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
    const rawLevel = request.query.level;
    const level = rawLevel ? vocabulary.normalizeLevel(rawLevel) : null;
    if (rawLevel && !level) {
      return fail(response, 400, "等级必须是 A1、A2、B1、B2、C1 或 C2");
    }
    ok(
      response,
      await vocabulary.listCategories({ level, query: request.query.q }),
    );
  }),
);

router.get(
  "/vocabulary/levels/:level",
  asyncRoute(async (request, response) => {
    const level = vocabulary.normalizeLevel(request.params.level);
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
        query: request.query.q,
      }),
    });
  }),
);

router.get(
  "/vocabulary/categories/:recordId",
  asyncRoute(async (request, response) => {
    const page = await vocabulary.getCategory(request.params.recordId);
    if (!page) {
      return fail(response, 404, "分类不存在");
    }
    ok(response, page);
  }),
);

router.get(
  "/search",
  asyncRoute(async (request, response) => {
    const query = String(request.query.q || "").trim();
    if (query.length < 1) {
      return ok(response, { categories: [], words: [] });
    }
    ok(response, await vocabulary.search(query));
  }),
);

module.exports = router;
