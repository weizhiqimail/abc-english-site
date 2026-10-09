const test = require("node:test");
const assert = require("node:assert/strict");
const { createTaskManager } = require("../src/tasks/taskManager");

const logger = {
  info() {},
  error() {},
};

test("local task reports real-time progress and completion", async () => {
  const taskDefinitions = new Map([
    [
      "test-task",
      {
        async execute(parameters, onProgress) {
          onProgress({ completed: 1, succeeded: 1, currentWordId: 1 });
          onProgress({
            completed: 2,
            succeeded: 1,
            skipped: 1,
            currentWordId: 2,
          });
          return parameters.wordIds;
        },
      },
    ],
  ]);
  const manager = createTaskManager({ taskDefinitions, logger });
  const created = manager.create("test-task", {
    wordIds: [1, 2],
    batchSize: 2,
    totalBatches: 1,
    ignorePublished: true,
  });

  const completed = await new Promise((resolve) => {
    const unsubscribe = manager.subscribe(created.id, (task) => {
      if (task.status === "completed") {
        unsubscribe();
        resolve(task);
      }
    });
  });

  assert.equal(completed.progress.completed, 2);
  assert.equal(completed.progress.succeeded, 1);
  assert.equal(completed.progress.skipped, 1);
  assert.deepEqual(completed.result, [1, 2]);
});
