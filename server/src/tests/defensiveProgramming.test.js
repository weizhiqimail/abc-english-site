const test = require("node:test");
const assert = require("node:assert/strict");
const prisma = require("../lib/prisma");
const vocabulary = require("../services/vocabularyService");
const { sanitize } = require("../services/errorLogService");
const {
  assertAllowedKeys,
  boundedInteger,
  positiveInteger,
  requirePlainObject,
  requiredString,
} = require("../utils/validation");

test("vocabulary service exposes and validates the level contract", () => {
  assert.equal(vocabulary.normalizeLevel(" a1 "), "A1");
  assert.equal(vocabulary.normalizeLevel("X1"), null);
  assert.equal(vocabulary.normalizeLevel(["A1"]), null);
  assert.equal(vocabulary.LEVELS.length, 6);
});

test("favorite lookup keys preserve both parts without delimiter collisions", () => {
  assert.notEqual(
    vocabulary.favoriteLookupKey("a:b", "c"),
    vocabulary.favoriteLookupKey("a", "b:c"),
  );
  assert.equal(
    vocabulary.favoriteLookupKey(12, "translation:34"),
    '["12","translation:34"]',
  );
});

test("favorite words are deduplicated and loaded with one bulk query", async () => {
  const originalFindMany = prisma.vocabularyWord.findMany;
  let receivedQuery;
  prisma.vocabularyWord.findMany = async (query) => {
    receivedQuery = query;
    return [
      {
        categoryRecordId: "category-1",
        translationId: "translation-1",
        wordEntryId: "word-1",
        word: "example",
        examples: [],
        category: { level: "A1", localizedTitle: "示例" },
      },
    ];
  };
  try {
    const result = await vocabulary.findWords([
      { recordId: "category-1", wordKey: "word-1" },
      { recordId: "category-1", wordKey: "word-1" },
      { recordId: "category-1", wordKey: "translation:translation-1" },
    ]);
    assert.equal(receivedQuery.where.OR.length, 2);
    assert.equal(result.size, 2);
    assert.equal(
      result.get(
        vocabulary.favoriteLookupKey("category-1", "translation:translation-1"),
      ).card.word,
      "example",
    );
  } finally {
    prisma.vocabularyWord.findMany = originalFindMany;
  }
});

test("request validation rejects ambiguous and oversized input", () => {
  assert.throws(() => requirePlainObject([]), /JSON 对象/);
  assert.throws(() => requiredString(["value"]), /字符串/);
  assert.throws(
    () => requiredString("x".repeat(101), { maxLength: 100 }),
    /最多/,
  );
  assert.throws(() => positiveInteger("1e3"), /正整数/);
  assert.throws(() => positiveInteger("0"), /正整数/);
  assert.throws(() => boundedInteger("101", { max: 100 }), /有效/);
  assert.throws(() => assertAllowedKeys({ role: "admin" }, ["name"]), /不支持/);
});

test("structured logging redacts secrets and handles circular values", () => {
  const value = { password: "secret", nested: { tokenHash: "hash" } };
  value.self = value;
  const result = sanitize(value);
  assert.equal(result.password, "[redacted]");
  assert.equal(result.nested.tokenHash, "[redacted]");
  assert.equal(result.self, "[circular]");
});
