const crypto = require("node:crypto");
const { EventEmitter } = require("node:events");

function publicTask(task) {
  const { wordIds, ...publicParameters } = task.parameters;
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    createdAt: task.createdAt,
    startedAt: task.startedAt,
    completedAt: task.completedAt,
    parameters: { ...publicParameters, wordCount: wordIds.length },
    progress: task.progress,
    result: task.result,
    error: task.error,
  };
}

function createTaskManager({ taskDefinitions, logger }) {
  const tasks = new Map();
  const events = new EventEmitter();

  function emit(task) {
    events.emit(task.id, publicTask(task));
  }

  function update(task, patch) {
    Object.assign(task, patch);
    emit(task);
  }

  function create(type, parameters) {
    const definition = taskDefinitions.get(type);
    if (!definition) throw new Error(`不支持的任务类型：${type}`);
    const task = {
      id: crypto.randomUUID(),
      type,
      status: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      parameters,
      progress: {
        total: parameters.wordIds.length,
        completed: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
        currentWordId: null,
        currentBatch: 0,
        totalBatches: parameters.totalBatches,
      },
      result: null,
      error: null,
    };
    tasks.set(task.id, task);
    logger.info("local-task.queued", { task: publicTask(task) });
    setImmediate(async () => {
      update(task, { status: "running", startedAt: new Date().toISOString() });
      logger.info("local-task.started", { task: publicTask(task) });
      try {
        const result = await definition.execute(parameters, (progress) => {
          task.progress = { ...task.progress, ...progress };
          emit(task);
          logger.info("local-task.progress", { task: publicTask(task) });
        });
        update(task, {
          status: "completed",
          completedAt: new Date().toISOString(),
          result,
        });
        logger.info("local-task.completed", { task: publicTask(task) });
      } catch (error) {
        update(task, {
          status: "failed",
          completedAt: new Date().toISOString(),
          error: error.message,
        });
        logger.error("local-task.failed", { task: publicTask(task), error });
      }
    });
    return publicTask(task);
  }

  function get(taskId) {
    const task = tasks.get(taskId);
    return task ? publicTask(task) : null;
  }

  function subscribe(taskId, listener) {
    events.on(taskId, listener);
    return () => events.off(taskId, listener);
  }

  return { create, get, subscribe };
}

module.exports = { createTaskManager };
