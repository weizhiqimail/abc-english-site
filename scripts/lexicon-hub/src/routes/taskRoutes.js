const express = require("express");
const { createTaskController } = require("../controllers/taskController");

function createTaskPageRouter(dependencies) {
  const router = express.Router();
  const controller = createTaskController(dependencies);
  router.get("/", controller.showTasks);
  return router;
}

function createTaskApiRouter({ taskManager, repository }) {
  const router = express.Router();

  router.post("/", async (request, response) => {
    try {
      const allowedLevels = new Set(["A1", "A2", "B1", "B2", "C1", "C2"]);
      const level = String(request.body.level || "").toUpperCase();
      if (!allowedLevels.has(level)) throw new Error("请选择有效的词汇等级");
      const batchSize = Math.min(
        100,
        Math.max(1, Number(request.body.batchSize || 100)),
      );
      const ignorePublished = request.body.ignorePublished !== false;
      const wordIds = await repository.listWordIdsForTask({
        level,
        ignorePublished,
      });
      if (!wordIds.length) throw new Error("该等级没有需要执行任务的词汇");
      const task = taskManager.create(request.body.taskType, {
        wordIds,
        level,
        batchSize,
        totalBatches: Math.ceil(wordIds.length / batchSize),
        ignorePublished,
      });
      response.status(202).json({ success: true, task });
    } catch (error) {
      response.status(400).json({ success: false, error: error.message });
    }
  });

  router.get("/:taskId", (request, response) => {
    const task = taskManager.get(request.params.taskId);
    if (!task) return response.status(404).json({ error: "任务不存在" });
    return response.json({ success: true, task });
  });

  router.get("/:taskId/events", (request, response) => {
    const task = taskManager.get(request.params.taskId);
    if (!task) return response.status(404).end();
    response.setHeader("content-type", "text/event-stream; charset=utf-8");
    response.setHeader("cache-control", "no-cache");
    response.setHeader("connection", "keep-alive");
    response.flushHeaders();
    const send = (value) =>
      response.write(`data: ${JSON.stringify(value)}\n\n`);
    send(task);
    const unsubscribe = taskManager.subscribe(
      request.params.taskId,
      (value) => {
        send(value);
        if (["completed", "failed"].includes(value.status)) response.end();
      },
    );
    request.on("close", unsubscribe);
  });

  return router;
}

module.exports = { createTaskApiRouter, createTaskPageRouter };
