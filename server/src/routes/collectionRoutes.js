const express = require("express");
const prisma = require("../lib/prisma");
const vocabulary = require("../services/vocabularyService");
const { requireAuth } = require("../middleware/auth");
const { ok, fail } = require("../utils/response");
const asyncRoute = require("../utils/asyncRoute");
const {
  assertAllowedKeys,
  positiveInteger,
  requirePlainObject,
  requiredString,
} = require("../utils/validation");
const { assertMethods } = require("../utils/contracts");

assertMethods(vocabulary, "vocabularyService", ["findWord", "findWords"]);

const router = express.Router();
router.use("/collections", requireAuth);

const includeFavorites = {
  favorites: { orderBy: { createdAt: "desc" } },
  _count: { select: { favorites: true } },
};

router.get(
  "/collections",
  asyncRoute(async (request, response) => {
    const collections = await prisma.collection.findMany({
      where: { userId: request.user.id },
      include: includeFavorites,
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
    const favorites = collections.flatMap((collection) => collection.favorites);
    const wordsByFavorite = await vocabulary.findWords(favorites);
    // 查询服务返回复合键 Map，路由只负责保持原收藏夹响应结构，不再逐条访问数据库。
    const hydrated = collections.map((collection) => ({
      ...collection,
      favorites: collection.favorites.map((favorite) => {
        const found = wordsByFavorite.get(
          vocabulary.favoriteLookupKey(favorite.recordId, favorite.wordKey),
        );
        return {
          ...favorite,
          card: found?.card || null,
          page: found?.page || null,
          word: found?.card?.word || favorite.wordKey,
          localizedDefinition: found?.card?.localizedDefinition || null,
          level: found?.page?.identity?.level || null,
          categoryTitle: found?.page.subcategory.localizedTitle || null,
        };
      }),
    }));
    ok(response, hydrated);
  }),
);

router.post(
  "/collections",
  asyncRoute(async (request, response) => {
    const body = requirePlainObject(request.body);
    assertAllowedKeys(body, ["name"]);
    const name = requiredString(body.name, {
      label: "收藏夹名称",
      maxLength: 100,
    });
    const collection = await prisma.collection.create({
      data: { name, userId: request.user.id },
      include: includeFavorites,
    });
    ok(response, collection, 201);
  }),
);

router.patch(
  "/collections/:id",
  asyncRoute(async (request, response) => {
    const id = positiveInteger(request.params.id, "收藏夹 ID");
    const collection = await prisma.collection.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!collection) {
      return fail(response, 404, "收藏夹不存在");
    }
    const body = requirePlainObject(request.body);
    assertAllowedKeys(body, ["name"]);
    const name = requiredString(body.name, {
      label: "收藏夹名称",
      maxLength: 100,
    });
    ok(
      response,
      await prisma.collection.update({
        where: { id },
        data: { name },
        include: includeFavorites,
      }),
    );
  }),
);

router.delete(
  "/collections/:id",
  asyncRoute(async (request, response) => {
    const id = positiveInteger(request.params.id, "收藏夹 ID");
    const collection = await prisma.collection.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!collection) {
      return fail(response, 404, "收藏夹不存在");
    }
    if (collection.isDefault) {
      return fail(response, 400, "默认收藏夹不可删除");
    }
    await prisma.collection.delete({ where: { id } });
    ok(response, { deleted: true });
  }),
);

router.post(
  "/collections/:id/favorites",
  asyncRoute(async (request, response) => {
    const collectionId = positiveInteger(request.params.id, "收藏夹 ID");
    const body = requirePlainObject(request.body);
    assertAllowedKeys(body, ["recordId", "wordKey"]);
    const recordId = requiredString(body.recordId, {
      label: "分类 ID",
      maxLength: 64,
      pattern: /^[A-Za-z0-9._:-]+$/,
      patternMessage: "分类 ID 格式错误",
    });
    const wordKey = requiredString(body.wordKey, {
      label: "词汇键",
      maxLength: 100,
      pattern: /^[A-Za-z0-9._:-]+$/,
      patternMessage: "词汇键格式错误",
    });
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId: request.user.id },
    });
    if (!collection) {
      return fail(response, 404, "收藏夹不存在");
    }
    const found = await vocabulary.findWord(recordId, wordKey);
    if (!found) {
      return fail(response, 404, "词汇不存在");
    }
    const favorite = await prisma.favorite.upsert({
      where: { collectionId_wordKey: { collectionId, wordKey } },
      update: { recordId },
      create: {
        collectionId,
        wordKey,
        recordId,
        wordEntryId:
          found.card.wordEntryId == null
            ? null
            : String(found.card.wordEntryId),
        translationId:
          found.card.translationId == null
            ? null
            : String(found.card.translationId),
      },
    });
    ok(response, favorite, 201);
  }),
);

router.delete(
  "/collections/:id/favorites/:wordKey",
  asyncRoute(async (request, response) => {
    const collectionId = positiveInteger(request.params.id, "收藏夹 ID");
    const wordKey = requiredString(request.params.wordKey, {
      label: "词汇键",
      maxLength: 100,
      pattern: /^[A-Za-z0-9._:-]+$/,
      patternMessage: "词汇键格式错误",
    });
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId: request.user.id },
    });
    if (!collection) {
      return fail(response, 404, "收藏夹不存在");
    }
    await prisma.favorite.deleteMany({
      where: { collectionId, wordKey },
    });
    ok(response, { deleted: true });
  }),
);

module.exports = router;
