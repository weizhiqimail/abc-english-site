const {
  createCompositePhoneticProvider,
} = require("./providers/compositeProvider");
const { createJsonPhoneticProvider } = require("./providers/jsonProvider");
const { createPhoneticService } = require("./services/phoneticService");
const { runSinglePhoneticTask } = require("./tasks/single");
const { runBatchPhoneticTask } = require("./tasks/batch");

function createPhoneticResolver(options = {}) {
  const providers = options.providers || [];
  if (!providers.length) throw new Error("至少配置一个有授权的音标 provider");
  return createPhoneticService({
    provider: createCompositePhoneticProvider(providers),
    concurrency: options.concurrency,
  });
}

module.exports = {
  createJsonPhoneticProvider,
  createPhoneticResolver,
  runSinglePhoneticTask,
  runBatchPhoneticTask,
};
