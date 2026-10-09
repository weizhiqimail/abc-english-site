const { loadTtsConfig } = require("./core/config");
const {
  createGoogleTtsProvider,
} = require("./providers/google/googleTtsProvider");
const { createSynthesisService } = require("./services/synthesisService");

const providerFactories = new Map([["google", createGoogleTtsProvider]]);

/** 注册额外供应商；只要实现 synthesize(request)，即可参与单个和批量任务。 */
function registerTtsProvider(name, factory) {
  providerFactories.set(name, factory);
}

function createTtsService(options = {}) {
  const config = loadTtsConfig(options.config);
  const factory =
    options.providerFactory || providerFactories.get(config.provider);
  if (!factory) throw new Error(`未知 TTS provider：${config.provider}`);
  const provider = options.provider || factory(options.providerOptions);
  return createSynthesisService({ provider, config });
}

module.exports = { createTtsService, registerTtsProvider };
