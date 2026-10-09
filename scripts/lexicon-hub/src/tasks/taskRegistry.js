function createTaskDefinitions({ imageMigrationService }) {
  return new Map([
    [
      "qiniu-image-sync",
      {
        label: "词汇图片同步到七牛云",
        async execute(parameters, onProgress) {
          const failures = [];
          let succeeded = 0;
          let failed = 0;
          let skipped = 0;
          for (
            let offset = 0;
            offset < parameters.wordIds.length;
            offset += parameters.batchSize
          ) {
            const currentBatch = Math.floor(offset / parameters.batchSize) + 1;
            const batchWordIds = parameters.wordIds.slice(
              offset,
              offset + parameters.batchSize,
            );
            const batchResults = await imageMigrationService.migrateMany(
              batchWordIds,
              {
                force: !parameters.ignorePublished,
                limit: parameters.batchSize,
                onProgress(batchProgress) {
                  onProgress({
                    total: parameters.wordIds.length,
                    completed: offset + batchProgress.completed,
                    succeeded: succeeded + batchProgress.succeeded,
                    failed: failed + batchProgress.failed,
                    skipped: skipped + batchProgress.skipped,
                    currentWordId: batchProgress.currentWordId,
                    currentBatch,
                    totalBatches: parameters.totalBatches,
                    batchCompleted: batchProgress.completed,
                    batchTotal: batchWordIds.length,
                    lastResult: batchProgress.lastResult,
                  });
                },
              },
            );
            succeeded += batchResults.filter(
              (item) => item.ok && item.value.status !== "skipped",
            ).length;
            skipped += batchResults.filter(
              (item) => item.ok && item.value.status === "skipped",
            ).length;
            failed += batchResults.filter((item) => !item.ok).length;
            failures.push(...batchResults.filter((item) => !item.ok));
          }
          return {
            total: parameters.wordIds.length,
            succeeded,
            failed,
            skipped,
            failures,
          };
        },
      },
    ],
  ]);
}

function listTaskTypes(taskDefinitions) {
  return [...taskDefinitions].map(([value, definition]) => ({
    value,
    label: definition.label,
  }));
}

module.exports = { createTaskDefinitions, listTaskTypes };
