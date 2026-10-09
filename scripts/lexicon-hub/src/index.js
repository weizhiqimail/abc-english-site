const { createObjectStorageTask } = require("../../qiniu");
const { createTtsService } = require("../../tts");
const {
  createJsonPhoneticProvider,
  createPhoneticResolver,
} = require("../../phonetic");
const { createApp } = require("./app");
const { loadConfig } = require("./config");
const { createLogger } = require("./logging/logger");
const { createLexiconRepository } = require("./repositories/lexiconRepository");
const {
  createLexiconEnrichmentService,
} = require("./services/lexiconEnrichmentService");
const {
  createImageMigrationService,
} = require("./services/imageMigrationService");
const { createTaskManager } = require("./tasks/taskManager");
const { createTaskDefinitions } = require("./tasks/taskRegistry");

const logger = createLogger({ context: { service: "lexicon-hub" } });

function start() {
  const config = loadConfig();
  logger.info("application.starting", {
    host: config.host,
    port: config.port,
    imageAllowedHosts: config.imageAllowedHosts,
    imageMaxBytes: config.imageMaxBytes,
    phoneticFileCount: config.phoneticFiles.length,
  });
  const repository = createLexiconRepository({ logger });
  const providers = config.phoneticFiles.map((filePath, index) =>
    createJsonPhoneticProvider({
      name: `phonetic-json-${index + 1}`,
      filePath,
    }),
  );
  if (!providers.length) {
    providers.push({ name: "unconfigured", resolve: async () => [] });
  }
  const phonetic = createPhoneticResolver({ providers });
  let tts;
  let storage;
  const enrichmentService = createLexiconEnrichmentService({
    repository,
    phonetic,
    getTts: () => (tts ||= createTtsService()),
    getStorage: () => (storage ||= createObjectStorageTask()),
    bucket: process.env.QINIU_BUCKET,
    logger,
  });
  const imageMigrationService = createImageMigrationService({
    repository,
    getStorage: () => (storage ||= createObjectStorageTask()),
    config,
    logger,
  });
  const taskDefinitions = createTaskDefinitions({ imageMigrationService });
  const taskManager = createTaskManager({ taskDefinitions, logger });
  const app = createApp({
    repository,
    enrichmentService,
    imageMigrationService,
    config,
    logger,
    taskDefinitions,
    taskManager,
  });
  const server = app.listen(config.port, config.host, () => {
    logger.info("application.started", {
      host: config.host,
      port: config.port,
    });
    console.log(`lexicon-hub 已启动：http://${config.host}:${config.port}`);
    console.log(
      `lexicon-hub 已启动：http://dev.abc-english-site.local:${config.port}`,
    );
  });
  async function shutdown() {
    logger.info("application.stopping");
    server.close();
    await repository.prisma.$disconnect();
    logger.info("application.stopped");
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

try {
  start();
} catch (error) {
  logger.error("application.start-failed", { error });
  console.error(`lexicon-hub 启动失败：${error.message}`);
  process.exitCode = 1;
}
