const prisma = require("../lib/prisma");

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_SET = new Set(LEVELS);

function normalizeLevel(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return LEVEL_SET.has(normalized) ? normalized : null;
}

// 将规范化数据库行还原成前端沿用的数据结构，切换数据源不影响页面组件。
const categorySummary = (category = {}) => ({
  recordId: category.recordId,
  subcategoryId: category.subcategoryId,
  level: category.level,
  index: category.classificationIndex,
  classificationKey: category.classificationKey,
  title: category.title,
  localizedTitle: category.localizedTitle,
  wordCount: category.wordCount,
});

// 对外只暴露一张有效图片：七牛已发布图片优先，否则回退到原始来源。
// 两套数据库字段均保留，增量同步不会覆盖或删除原始图片地址。
const effectivePhotoUrl = (row = {}) =>
  row.ownedImageUrl || row.photoUrl || null;

const cardFromRow = (row = {}) => ({
  translationId: row.translationId,
  wordEntryId: row.wordEntryId,
  word: row.word,
  definition: row.definition,
  localizedDefinition: row.localizedDefinition,
  localizedOtherTranslations: row.localizedOtherTranslations,
  partOfSpeech: row.partOfSpeechType
    ? {
        partOfSpeechType: row.partOfSpeechType,
        grammaticalInformation: {
          pluralForm: row.pluralForm,
          composition: row.composition,
          isCountable: row.isCountable,
          hypernyms: Array.isArray(row.hypernyms) ? row.hypernyms : null,
        },
      }
    : null,
  photo: effectivePhotoUrl(row)
    ? {
        originalTitle: row.photoOriginalTitle,
        url: effectivePhotoUrl(row),
        thumbnailUrl:
          row.ownedImageUrl || row.photoThumbnailUrl || row.photoUrl,
      }
    : null,
  examples: (Array.isArray(row.examples) ? row.examples : []).map(
    (example) => ({
      id: example.sourceId || example.id,
      example: example.example,
      localizedProperties: { example: example.localizedExample || "" },
    }),
  ),
});

async function getOverview() {
  const grouped = await prisma.vocabularyCategory.groupBy({
    by: ["level"],
    _count: { _all: true },
    _sum: { wordCount: true },
  });
  const safeGrouped = Array.isArray(grouped) ? grouped : [];
  const byLevel = new Map(safeGrouped.map((row) => [row.level, row]));
  const levels = LEVELS.map((level) => {
    const row = byLevel.get(level);
    return {
      level,
      categoryCount: row?._count._all || 0,
      wordCount: row?._sum.wordCount || 0,
      available: Boolean(row?._count._all),
    };
  });
  return {
    categoryCount: levels.reduce((sum, item) => sum + item.categoryCount, 0),
    wordCount: levels.reduce((sum, item) => sum + item.wordCount, 0),
    levels,
    loadedAt: new Date().toISOString(),
    source: "postgres",
  };
}

async function listCategories({ level, query } = {}) {
  if (level != null && !normalizeLevel(level)) {
    throw new TypeError("listCategories 收到无效等级");
  }
  const needle = String(query || "").trim();
  const rows = await prisma.vocabularyCategory.findMany({
    where: {
      ...(level ? { level } : {}),
      ...(needle
        ? {
            OR: [
              { title: { contains: needle, mode: "insensitive" } },
              { localizedTitle: { contains: needle, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ level: "asc" }, { classificationIndex: "asc" }],
  });
  return (Array.isArray(rows) ? rows : []).map(categorySummary);
}

async function getCategory(recordId) {
  if (typeof recordId !== "string" || !recordId.trim()) return null;
  const category = await prisma.vocabularyCategory.findUnique({
    where: { recordId },
    include: {
      words: {
        orderBy: { position: "asc" },
        include: { examples: { orderBy: { position: "asc" } } },
      },
    },
  });
  if (!category) {
    return null;
  }
  // 原始数据允许分类序号重复，因此通过 recordId 在完整排序列表中定位前后项。
  const levelCategories = await prisma.vocabularyCategory.findMany({
    where: { level: category.level },
    orderBy: [{ classificationIndex: "asc" }, { recordId: "asc" }],
  });
  const categoryPosition = levelCategories.findIndex(
    (item) => item.recordId === category.recordId,
  );
  const previous = levelCategories[categoryPosition - 1];
  const next = levelCategories[categoryPosition + 1];
  return {
    identity: {
      level: category.level,
      classificationIndex: category.classificationIndex,
      classificationKey: category.classificationKey,
    },
    subcategory: {
      id: category.subcategoryId,
      title: category.title,
      localizedTitle: category.localizedTitle,
      description: category.description,
      localizedDescription: category.localizedDescription,
      estimatedLearningTimeSeconds: category.estimatedLearningTimeSeconds,
    },
    cards: (Array.isArray(category.words) ? category.words : []).map(
      cardFromRow,
    ),
    adjacent: {
      previous: previous ? categorySummary(previous) : null,
      next: next ? categorySummary(next) : null,
    },
  };
}

async function search(query, limit = 60) {
  const needle = String(query || "").trim();
  if (!needle) {
    return { categories: [], words: [] };
  }
  const safeLimit = Number.isSafeInteger(limit)
    ? Math.min(100, Math.max(1, limit))
    : 60;
  const [categories, words] = await Promise.all([
    listCategories({ query: needle }).then((items) => items.slice(0, 20)),
    prisma.vocabularyWord.findMany({
      where: {
        OR: [
          { word: { contains: needle, mode: "insensitive" } },
          { definition: { contains: needle, mode: "insensitive" } },
          {
            localizedDefinition: {
              contains: needle,
              mode: "insensitive",
            },
          },
          {
            localizedOtherTranslations: {
              contains: needle,
              mode: "insensitive",
            },
          },
        ],
      },
      include: { category: true },
      take: safeLimit,
      orderBy: { id: "asc" },
    }),
  ]);
  return {
    categories,
    words: (Array.isArray(words) ? words : []).map((row) => ({
      recordId: row.categoryRecordId,
      level: row.category.level,
      categoryIndex: row.category.classificationIndex,
      categoryTitle: row.category.localizedTitle,
      wordKey: row.wordEntryId || `translation:${row.translationId}`,
      word: row.word,
      localizedDefinition: row.localizedDefinition,
      definition: row.definition,
      partOfSpeech: row.partOfSpeechType,
      photo: effectivePhotoUrl(row)
        ? {
            originalTitle: row.photoOriginalTitle,
            url: effectivePhotoUrl(row),
            thumbnailUrl:
              row.ownedImageUrl || row.photoThumbnailUrl || row.photoUrl,
          }
        : null,
    })),
  };
}

async function findWord(recordId, wordKey) {
  if (
    typeof recordId !== "string" ||
    !recordId.trim() ||
    typeof wordKey !== "string" ||
    !wordKey.trim()
  ) {
    return null;
  }
  const isTranslation = wordKey.startsWith("translation:");
  const value = isTranslation ? wordKey.slice("translation:".length) : wordKey;
  const row = await prisma.vocabularyWord.findFirst({
    where: {
      categoryRecordId: recordId,
      ...(isTranslation ? { translationId: value } : { wordEntryId: value }),
    },
    include: {
      category: true,
      examples: { orderBy: { position: "asc" } },
    },
  });
  if (!row) {
    return null;
  }
  return {
    page: {
      identity: { level: row.category.level },
      subcategory: { localizedTitle: row.category.localizedTitle },
    },
    card: cardFromRow(row),
  };
}

const favoriteLookupKey = (recordId, wordKey) =>
  JSON.stringify([String(recordId), String(wordKey)]);
const FAVORITE_QUERY_BATCH_SIZE = 250;

async function findWords(favorites = []) {
  if (!Array.isArray(favorites) || favorites.length === 0) return new Map();
  const unique = new Map();
  for (const favorite of favorites) {
    const recordId = String(favorite?.recordId || "").trim();
    const wordKey = String(favorite?.wordKey || "").trim();
    if (recordId && wordKey) {
      unique.set(favoriteLookupKey(recordId, wordKey), { recordId, wordKey });
    }
  }
  if (unique.size === 0) return new Map();

  // 收藏关系没有直接外键到词条，需按 (分类 ID, 词条键) 批量匹配。
  // 每批设置上限并顺序执行，既消除 N+1，也避免超大 OR 和并发查询冲击 Serverless 连接池。
  const rows = [];
  const entries = [...unique.values()];
  for (
    let offset = 0;
    offset < entries.length;
    offset += FAVORITE_QUERY_BATCH_SIZE
  ) {
    const batch = entries.slice(offset, offset + FAVORITE_QUERY_BATCH_SIZE);
    rows.push(
      ...(await prisma.vocabularyWord.findMany({
        where: {
          OR: batch.map(({ recordId, wordKey }) => {
            const isTranslation = wordKey.startsWith("translation:");
            return {
              categoryRecordId: recordId,
              ...(isTranslation
                ? { translationId: wordKey.slice("translation:".length) }
                : { wordEntryId: wordKey }),
            };
          }),
        },
        include: {
          category: true,
          examples: { orderBy: { position: "asc" } },
        },
      })),
    );
  }
  const found = new Map();
  for (const row of rows) {
    const value = {
      page: {
        identity: { level: row.category.level },
        subcategory: { localizedTitle: row.category.localizedTitle },
      },
      card: cardFromRow(row),
    };
    // 历史收藏可能使用 translation: 键，即使同一行后来已经具备 wordEntryId，也必须按原键命中。
    const candidateKeys = [
      row.wordEntryId && String(row.wordEntryId),
      `translation:${row.translationId}`,
    ].filter(Boolean);
    for (const wordKey of candidateKeys) {
      const key = favoriteLookupKey(row.categoryRecordId, wordKey);
      if (unique.has(key)) found.set(key, value);
    }
  }
  return found;
}

module.exports = {
  LEVELS,
  normalizeLevel,
  getOverview,
  listCategories,
  getCategory,
  search,
  findWord,
  findWords,
  favoriteLookupKey,
};
