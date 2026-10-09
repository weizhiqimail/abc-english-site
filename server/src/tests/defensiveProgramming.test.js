const test = require("node:test");
const assert = require("node:assert/strict");
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
