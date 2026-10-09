const { createObjectStorageTask } = require("../../../qiniu");
const { loadConfig } = require("../config");
const { createLogger } = require("../logging/logger");
const {
  createLexiconRepository,
} = require("../repositories/lexiconRepository");
const {
  createImageMigrationService,
} = require("../services/imageMigrationService");

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];

function selectedLevels(arguments_) {
  const value = arguments_.find((argument) => argument.startsWith("--levels="));
  if (!value) return LEVELS;
  const levels = value
    .slice("--levels=".length)
    .split(",")
    .map((level) => level.trim().toUpperCase())
    .filter((level) => LEVELS.includes(level));
  if (!levels.length) throw new Error("--levels 没有包含有效等级");
  return [...new Set(levels)];
}

async function main() {
  const levels = selectedLevels(process.argv.slice(2));
  const logger = createLogger({
    context: { service: "lexicon-hub", command: "sync-images" },
  });
  const repository = createLexiconRepository({ logger });
  const config = loadConfig();
  let storage;
  const migration = createImageMigrationService({
    repository,
    getStorage: () => (storage ||= createObjectStorageTask()),
    config,
    logger,
  });
  const totals = { selected: 0, published: 0, skipped: 0, failed: 0 };

  try {
    for (const level of levels) {
      const wordIds = await repository.listWordIdsForTask({
        level,
        ignorePublished: true,
      });
      totals.selected += wordIds.length;
      console.log(`${level}：需要同步 ${wordIds.length} 张图片`);

      for (let offset = 0; offset < wordIds.length; offset += 100) {
        const batch = wordIds.slice(offset, offset + 100);
        const results = await migration.migrateMany(batch, {
          limit: 100,
          concurrency: 3,
        });
        totals.published += results.filter(
          (result) => result.ok && result.value.status === "published",
        ).length;
        totals.skipped += results.filter(
          (result) => result.ok && result.value.status === "skipped",
        ).length;
        totals.failed += results.filter((result) => !result.ok).length;
        console.log(
          `${level}：${Math.min(offset + batch.length, wordIds.length)}/${wordIds.length}，` +
            `累计成功 ${totals.published}，失败 ${totals.failed}，跳过 ${totals.skipped}`,
        );
      }
    }

    console.log(`同步完成：${JSON.stringify(totals)}`);
    const consistency = await repository.prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE photo_url IS NOT NULL)::int AS original,
        COUNT(*) FILTER (WHERE owned_image_url IS NOT NULL)::int AS qiniu,
        COUNT(*) FILTER (
          WHERE photo_url IS NOT NULL AND owned_image_url IS NULL
        )::int AS needs_upload,
        COUNT(*) FILTER (
          WHERE photo_url IS NULL AND owned_image_url IS NOT NULL
        )::int AS inconsistent,
        COUNT(*) FILTER (
          WHERE photo_url IS NULL AND owned_image_url IS NULL
        )::int AS no_image
      FROM vocabulary_words
    `);
    console.log(`数据库图片一致性：${JSON.stringify(consistency[0])}`);
    if (totals.failed > 0) process.exitCode = 2;
  } finally {
    await repository.prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`图片同步任务失败：${error.stack || error.message}`);
  process.exitCode = 1;
});
