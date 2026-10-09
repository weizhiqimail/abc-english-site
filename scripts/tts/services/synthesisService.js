const { createRequestFingerprint } = require("../core/fingerprint");

function validateInput(input) {
  if (!input || (!input.text && !input.ssml))
    throw new TypeError("text 或 ssml 至少提供一个");
  if (!input.locale) throw new TypeError("locale 不能为空");
}

/** TTS 业务服务不绑定“词汇”，以后可原样用于例句或其他文本。 */
function createSynthesisService({ provider, config }) {
  async function synthesize(input) {
    validateInput(input);
    const request = {
      ...input,
      voiceName: input.voiceName || config.voices[input.locale],
      audioEncoding: input.audioEncoding || config.audioEncoding,
      speakingRate: input.speakingRate ?? config.speakingRate,
      pitch: input.pitch ?? config.pitch,
    };
    if (!request.voiceName)
      throw new Error(`没有为 ${request.locale} 配置 voice`);
    const fingerprint = createRequestFingerprint(request);
    const result = await provider.synthesize(request);
    return { ...result, request, fingerprint, byteSize: result.audio.length };
  }

  /** 批量任务限制并发，并保留每一项的成功/失败状态，单项失败不会回滚整批。 */
  async function synthesizeMany(inputs, options = {}) {
    const concurrency = Math.max(
      1,
      Number(options.concurrency || config.concurrency),
    );
    const results = new Array(inputs.length);
    let cursor = 0;
    async function worker() {
      while (cursor < inputs.length) {
        const index = cursor++;
        try {
          results[index] = { ok: true, value: await synthesize(inputs[index]) };
        } catch (error) {
          results[index] = {
            ok: false,
            error: error.message,
            input: inputs[index],
          };
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(concurrency, inputs.length) }, worker),
    );
    return results;
  }
  return { synthesize, synthesizeMany };
}

module.exports = { createSynthesisService };
