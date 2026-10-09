const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildImageObjectKey,
  createImageMigrationService,
} = require("../src/services/imageMigrationService");

test("image object key keeps word directory without hash shard directory", () => {
  const digest =
    "17abe44641824874c7d034eb39e07bc45b330aa8fb68b8dd7bebc81f957ceb84";
  assert.equal(
    buildImageObjectKey(12292, digest, "jpg"),
    `abc-english/vocabulary/images/v1/12292/${digest}.jpg`,
  );
});

test("word without a source image is skipped instead of reported as failed", async () => {
  const service = createImageMigrationService({
    repository: {
      getWord: async () => ({
        id: 42,
        photoUrl: null,
        photoThumbnailUrl: null,
        ownedImageUrl: null,
        ownedImageStatus: "pending",
      }),
    },
    getStorage() {
      throw new Error("storage should not be created");
    },
    config: { imageAllowedHosts: [], imageMaxBytes: 1024 },
    logger: {
      child() {
        return { info() {}, error() {} };
      },
    },
  });

  assert.deepEqual(await service.migrateOne(42), {
    wordId: 42,
    status: "skipped",
    reason: "no-source-image",
  });
});
