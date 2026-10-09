const assert = require("node:assert/strict");
const test = require("node:test");
const { createPhoneticResolver } = require("..");

test("支持多个音标来源以及单个和批量任务", async () => {
  const first = {
    name: "one",
    resolve: async () => [{ locale: "en-US", ipa: "həˈloʊ" }],
  };
  const second = {
    name: "two",
    resolve: async () => [{ locale: "en-GB", ipa: "həˈləʊ" }],
  };
  const service = createPhoneticResolver({ providers: [first, second] });
  const result = await service.resolveOne({ word: "Hello" });
  assert.equal(result.candidates.length, 2);
  assert.equal((await service.resolveMany([{ word: "Hello" }]))[0].ok, true);
});
