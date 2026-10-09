const express = require("express");
const prisma = require("../lib/prisma");
const vocabulary = require("../services/vocabularyService");
const { requireAuth } = require("../middleware/auth");
const { ok, fail } = require("../utils/response");
const asyncRoute = require("../utils/asyncRoute");

const router = express.Router();
router.use(requireAuth);

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
    const hydrated = await Promise.all(
      collections.map(async (collection) => ({
        ...collection,
        favorites: await Promise.all(
          collection.favorites.map(async (favorite) => {
            const found = await vocabulary.findWord(
              favorite.recordId,
              favorite.wordKey,
            );
            return {
              ...favorite,
              word: found?.card.word || favorite.wordKey,
              localizedDefinition: found?.card.localizedDefinition || null,
              level: found?.page.identity.level || null,
              categoryTitle: found?.page.subcategory.localizedTitle || null,
            };
          }),
        ),
      })),
    );
    ok(response, hydrated);
  }),
);

router.post(
  "/collections",
  asyncRoute(async (request, response) => {
    const name = String(request.body?.name || "").trim();
    if (!name) {
      return fail(response, 400, "请输入收藏夹名称");
    }
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
    const id = Number(request.params.id);
    const collection = await prisma.collection.findFirst({
      where: { id, userId: request.user.id },
    });
    if (!collection) {
      return fail(response, 404, "收藏夹不存在");
    }
    const name = String(request.body?.name || "").trim();
    if (!name) {
      return fail(response, 400, "请输入收藏夹名称");
    }
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
    const id = Number(request.params.id);
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
    const collectionId = Number(request.params.id);
    const recordId = String(request.body?.recordId || "");
    const wordKey = String(request.body?.wordKey || "");
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
    const collectionId = Number(request.params.id);
    const collection = await prisma.collection.findFirst({
      where: { id: collectionId, userId: request.user.id },
    });
    if (!collection) {
      return fail(response, 404, "收藏夹不存在");
    }
    await prisma.favorite.deleteMany({
      where: { collectionId, wordKey: request.params.wordKey },
    });
    ok(response, { deleted: true });
  }),
);

module.exports = router;
