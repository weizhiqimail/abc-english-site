const {
  PrismaClient,
} = require("../../../../server/generated/postgres-client");

function createLexiconRepository(options = {}) {
  const logger = options.logger?.child({ component: "postgres" });
  const databaseUrl =
    options.databaseUrl ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL;
  if (!databaseUrl)
    throw new Error(
      "缺少 PostgreSQL 连接：请通过 npm start 加载 Vercel Development 环境，或配置 POSTGRES_PRISMA_URL / DATABASE_URL_UNPOOLED",
    );
  const prisma =
    options.prisma || new PrismaClient({ datasourceUrl: databaseUrl });

  async function listWords(filters) {
    logger?.debug("postgres.words.query.started", { filters });
    const where = {
      ...(filters.level ? { category: { level: filters.level } } : {}),
      ...(filters.categoryRecordId
        ? { categoryRecordId: filters.categoryRecordId }
        : {}),
      ...(filters.keyword
        ? { word: { contains: filters.keyword, mode: "insensitive" } }
        : {}),
    };
    const pagination =
      filters.paginate === false
        ? {}
        : {
            skip: (filters.page - 1) * filters.pageSize,
            take: filters.pageSize,
          };
    const [items, total, categories] = await Promise.all([
      prisma.vocabularyWord.findMany({
        where,
        include: {
          category: true,
          pronunciations: {
            include: { pronunciation: { include: { audio: true } } },
          },
        },
        orderBy: [
          { category: { level: "asc" } },
          { category: { classificationIndex: "asc" } },
          { position: "asc" },
        ],
        ...pagination,
      }),
      prisma.vocabularyWord.count({ where }),
      prisma.vocabularyCategory.findMany({
        orderBy: [{ level: "asc" }, { classificationIndex: "asc" }],
      }),
    ]);
    logger?.debug("postgres.words.query.completed", {
      filters,
      returnedRows: items.length,
      totalRows: total,
      categoryCount: categories.length,
    });
    return { items, total, categories };
  }

  async function listCategories() {
    logger?.debug("postgres.categories.query.started");
    const categories = await prisma.vocabularyCategory.findMany({
      orderBy: [{ level: "asc" }, { classificationIndex: "asc" }],
    });
    logger?.debug("postgres.categories.query.completed", {
      returnedRows: categories.length,
    });
    return categories;
  }

  async function listWordIdsForTask({ level, ignorePublished }) {
    logger?.info("postgres.task-word-ids.query.started", {
      level,
      ignorePublished,
    });
    const words = await prisma.vocabularyWord.findMany({
      where: {
        category: { level },
        // 没有任何原始图片的词汇无需进入上传队列；它们应保持两套 URL 都为空。
        OR: [{ photoUrl: { not: null } }, { photoThumbnailUrl: { not: null } }],
        ...(ignorePublished
          ? {
              NOT: {
                ownedImageStatus: "published",
                ownedImageUrl: { not: null },
              },
            }
          : {}),
      },
      select: { id: true },
      orderBy: [
        { category: { classificationIndex: "asc" } },
        { position: "asc" },
      ],
    });
    const wordIds = words.map((word) => word.id);
    logger?.info("postgres.task-word-ids.query.completed", {
      level,
      ignorePublished,
      count: wordIds.length,
    });
    return wordIds;
  }

  async function getProgress() {
    return prisma.$queryRawUnsafe(`
      SELECT c.level, c.record_id, c.title, COUNT(w.id)::int AS total,
        COUNT(DISTINCT CASE WHEN w.owned_image_url IS NOT NULL THEN w.id END)::int AS with_image,
        COUNT(DISTINCT CASE WHEN wp.word_id IS NOT NULL THEN w.id END)::int AS with_phonetic,
        COUNT(DISTINCT CASE WHEN a.status = 'published' THEN w.id END)::int AS with_audio
      FROM vocabulary_categories c
      LEFT JOIN vocabulary_words w ON w.category_record_id = c.record_id
      LEFT JOIN vocabulary_word_pronunciations wp ON wp.word_id = w.id
      LEFT JOIN vocabulary_pronunciation_audio a ON a.pronunciation_id = wp.pronunciation_id
      GROUP BY c.level, c.record_id, c.title, c.classification_index
      ORDER BY c.level, c.classification_index
    `);
  }

  async function getWord(wordId) {
    logger?.debug("postgres.word.query.started", { wordId });
    const word = await prisma.vocabularyWord.findUnique({
      where: { id: Number(wordId) },
      include: { category: true },
    });
    logger?.debug("postgres.word.query.completed", {
      wordId,
      found: Boolean(word),
      word,
    });
    return word;
  }

  async function markImageProcessing(wordId) {
    // vocabulary_words 是图片发布状态的唯一事实来源；七牛对象列表不参与页面状态判断。
    logger?.info("postgres.image-status.updating", {
      wordId,
      nextStatus: "uploading",
    });
    const result = await prisma.vocabularyWord.update({
      where: { id: Number(wordId) },
      data: { ownedImageStatus: "uploading", ownedImageError: null },
    });
    logger?.info("postgres.image-status.updated", {
      wordId,
      status: result.ownedImageStatus,
    });
    return result;
  }

  async function markImagePublished(wordId, upload) {
    // 只有七牛确认上传成功后才同时落库 object key、公开 URL 和 published 状态。
    logger?.info("postgres.image-status.publishing", {
      wordId,
      upload,
    });
    const result = await prisma.vocabularyWord.update({
      where: { id: Number(wordId) },
      data: {
        ownedImageUrl: upload.publicUrl,
        ownedImageObjectKey: upload.key,
        ownedImageStatus: "published",
        ownedImageError: null,
      },
    });
    logger?.info("postgres.image-status.published", {
      wordId,
      ownedImageObjectKey: result.ownedImageObjectKey,
      ownedImageUrl: result.ownedImageUrl,
    });
    return result;
  }

  async function markImageFailed(wordId, error) {
    // 保留最近一次错误，操作页可直接展示并允许用户重新执行。
    logger?.error("postgres.image-status.failing", { wordId, error });
    const result = await prisma.vocabularyWord.update({
      where: { id: Number(wordId) },
      data: {
        ownedImageStatus: "failed",
        ownedImageError: String(error).slice(0, 2000),
      },
    });
    logger?.error("postgres.image-status.failed", {
      wordId,
      storedError: result.ownedImageError,
    });
    return result;
  }

  async function savePronunciation(wordId, candidate) {
    logger?.info("postgres.pronunciation.saving", { wordId, candidate });
    const result = await prisma.$transaction(async (tx) => {
      const identity = {
        normalizedWord: candidate.normalizedWord,
        locale: candidate.locale,
        ipa: candidate.ipa,
        partOfSpeech: candidate.partOfSpeech || null,
      };
      const existing = await tx.vocabularyPronunciation.findFirst({
        where: identity,
      });
      const pronunciation = existing
        ? await tx.vocabularyPronunciation.update({
            where: { id: existing.id },
            data: {
              sourceVersion: candidate.sourceVersion || null,
              sourceLicense: candidate.sourceLicense || null,
            },
          })
        : await tx.vocabularyPronunciation.create({
            data: {
              ...identity,
              sourceProvider: candidate.sourceProvider,
              sourceEntryId: candidate.sourceEntryId || null,
              sourceVersion: candidate.sourceVersion || null,
              sourceLicense: candidate.sourceLicense || null,
              verificationStatus: candidate.verificationStatus || "imported",
            },
          });
      await tx.vocabularyWordPronunciation.upsert({
        where: {
          wordId_pronunciationId: {
            wordId: Number(wordId),
            pronunciationId: pronunciation.id,
          },
        },
        update: {},
        create: {
          wordId: Number(wordId),
          pronunciationId: pronunciation.id,
          isPrimary: true,
        },
      });
      return pronunciation;
    });
    logger?.info("postgres.pronunciation.saved", {
      wordId,
      pronunciation: result,
    });
    return result;
  }

  async function findPublishedAudio(pronunciationId, fingerprint) {
    return prisma.vocabularyPronunciationAudio.findUnique({
      where: {
        pronunciationId_requestFingerprint: {
          pronunciationId,
          requestFingerprint: fingerprint,
        },
      },
    });
  }

  /** 只有七牛上传成功后才把音频标记为 published，避免产生不可播放记录。 */
  async function publishAudio(pronunciation, synthesis, upload, bucket) {
    logger?.info("postgres.audio.publishing", {
      pronunciationId: pronunciation.id,
      synthesis: {
        provider: synthesis.provider,
        request: synthesis.request,
        fingerprint: synthesis.fingerprint,
        byteSize: synthesis.byteSize,
        mimeType: synthesis.mimeType,
      },
      upload,
      bucket,
    });
    const result = await prisma.vocabularyPronunciationAudio.upsert({
      where: {
        pronunciationId_requestFingerprint: {
          pronunciationId: pronunciation.id,
          requestFingerprint: synthesis.fingerprint,
        },
      },
      update: {
        bucket,
        objectKey: upload.key,
        publicUrl: upload.publicUrl,
        qiniuHash: upload.hash,
        byteSize: upload.size,
        status: "published",
        errorCode: null,
        errorMessage: null,
      },
      create: {
        pronunciationId: pronunciation.id,
        provider: synthesis.provider,
        voiceName: synthesis.request.voiceName,
        voiceLocale: synthesis.request.locale,
        audioEncoding: synthesis.request.audioEncoding,
        speakingRate: synthesis.request.speakingRate,
        pitch: synthesis.request.pitch,
        requestFingerprint: synthesis.fingerprint,
        bucket,
        objectKey: upload.key,
        publicUrl: upload.publicUrl,
        qiniuHash: upload.hash,
        byteSize: upload.size,
        status: "published",
      },
    });
    logger?.info("postgres.audio.published", {
      pronunciationId: pronunciation.id,
      audio: result,
    });
    return result;
  }

  return {
    prisma,
    listCategories,
    listWordIdsForTask,
    listWords,
    getProgress,
    getWord,
    markImageProcessing,
    markImagePublished,
    markImageFailed,
    savePronunciation,
    findPublishedAudio,
    publishAudio,
  };
}

module.exports = { createLexiconRepository };
