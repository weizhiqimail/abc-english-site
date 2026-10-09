const assert = require("node:assert/strict");
const test = require("node:test");
const { createTtsService } = require("..");

test("单个与批量合成共用 provider，并返回稳定指纹", async () => {
  const provider = {
    synthesize: async ({ text }) => ({
      audio: Buffer.from(text),
      mimeType: "audio/mpeg",
    }),
  };
  const service = createTtsService({
    provider,
    config: { voices: { "en-US": "test" } },
  });
  const first = await service.synthesize({ text: "hello", locale: "en-US" });
  const second = await service.synthesize({ text: "hello", locale: "en-US" });
  assert.equal(first.fingerprint, second.fingerprint);
  const batch = await service.synthesizeMany([
    { text: "one", locale: "en-US" },
    { text: "two", locale: "en-US" },
  ]);
  assert.deepEqual(
    batch.map((item) => item.ok),
    [true, true],
  );
});
