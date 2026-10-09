const { normalizeWord } = require("../core/normalizeWord");

function createPhoneticService({ provider, concurrency = 5 }) {
  async function resolveOne(input) {
    if (!input?.word?.trim()) throw new TypeError("word 不能为空");
    const result = await provider.resolve(input);
    const normalized = Array.isArray(result)
      ? { candidates: result, warnings: [] }
      : result;
    return {
      word: input.word,
      normalizedWord: normalizeWord(input.word),
      ...normalized,
    };
  }

  async function resolveMany(inputs, options = {}) {
    const limit = Math.max(1, Number(options.concurrency || concurrency));
    const results = new Array(inputs.length);
    let cursor = 0;
    async function worker() {
      while (cursor < inputs.length) {
        const index = cursor++;
        try {
          results[index] = { ok: true, value: await resolveOne(inputs[index]) };
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
      Array.from({ length: Math.min(limit, inputs.length) }, worker),
    );
    return results;
  }
  return { resolveOne, resolveMany };
}

module.exports = { createPhoneticService };
