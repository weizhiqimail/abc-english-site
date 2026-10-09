const test = require("node:test");
const assert = require("node:assert/strict");
const { createTaskDefinitions } = require("../src/tasks/taskRegistry");

test("level task splits a large job into batches of at most 100", async () => {
  const batches = [];
  const imageMigrationService = {
    async migrateMany(wordIds, options) {
      batches.push(wordIds);
      wordIds.forEach((wordId, index) => {
        options.onProgress({
          total: wordIds.length,
          completed: index + 1,
          succeeded: index + 1,
          failed: 0,
          skipped: 0,
          currentWordId: wordId,
          lastResult: { ok: true, value: { status: "published" } },
        });
      });
      return wordIds.map(() => ({
        ok: true,
        value: { status: "published" },
      }));
    },
  };
  const definitions = createTaskDefinitions({ imageMigrationService });
  const progressEvents = [];
  const result = await definitions.get("qiniu-image-sync").execute(
    {
      wordIds: Array.from({ length: 205 }, (_, index) => index + 1),
      batchSize: 100,
      totalBatches: 3,
      ignorePublished: true,
    },
    (progress) => progressEvents.push(progress),
  );

  assert.deepEqual(
    batches.map((batch) => batch.length),
    [100, 100, 5],
  );
  assert.equal(result.total, 205);
  assert.equal(result.succeeded, 205);
  assert.equal(progressEvents.at(-1).completed, 205);
  assert.equal(progressEvents.at(-1).currentBatch, 3);
});
