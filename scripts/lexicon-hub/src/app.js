const path = require("node:path");
const express = require("express");
const { createApiRouter } = require("./routes/apiRoutes");
const { createOperationRouter } = require("./routes/operationRoutes");
const { createVocabularyRouter } = require("./routes/vocabularyRoutes");
const {
  createTaskApiRouter,
  createTaskPageRouter,
} = require("./routes/taskRoutes");
const { createHttpLogger } = require("./logging/httpLogger");

function createApp({
  repository,
  enrichmentService,
  imageMigrationService,
  config,
  logger,
  taskDefinitions,
  taskManager,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(createHttpLogger(logger));
  app.use("/assets", express.static(path.join(__dirname, "public")));

  app.get("/", (_request, response) => response.redirect("/vocabulary/levels"));
  app.use("/vocabulary", createVocabularyRouter({ repository, config }));
  app.use("/operations", createOperationRouter({ repository, config, logger }));
  app.use(
    "/tasks",
    createTaskPageRouter({ repository, config, taskDefinitions }),
  );
  app.use(
    "/api",
    createApiRouter({ enrichmentService, imageMigrationService }),
  );
  app.use("/api/tasks", createTaskApiRouter({ taskManager, repository }));

  app.use((error, request, response, _next) => {
    request.log?.error("http.request.failed", { error });
    logger.error("application.unhandled-error", { error });
    response.status(500).send(`服务错误：${error.message}`);
  });
  return app;
}

module.exports = { createApp };
