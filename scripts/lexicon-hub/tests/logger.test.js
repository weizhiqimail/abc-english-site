const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_FILE_BYTES, createLogger } = require("../src/logging/logger");

test("logger redacts secrets and rotates files below 10 MiB", () => {
  const logDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "lexicon-logs-"));
  try {
    const logger = createLogger({ logDirectory, context: { service: "test" } });
    for (let index = 0; index < 1_350; index += 1) {
      logger.info("rotation.test", {
        index,
        accessKey: "must-not-appear",
        payload: "x".repeat(9_000),
      });
    }
    const files = fs.readdirSync(logDirectory).sort();
    assert.ok(files.length >= 2);
    files.forEach((fileName) => {
      assert.match(fileName, /^\d{4}-\d{2}-\d{2}-\d{5}\.log$/);
      assert.ok(
        fs.statSync(path.join(logDirectory, fileName)).size <= MAX_FILE_BYTES,
      );
    });
    const content = files
      .map((fileName) =>
        fs.readFileSync(path.join(logDirectory, fileName), "utf8"),
      )
      .join("");
    assert.doesNotMatch(content, /must-not-appear/);
    assert.match(content, /\[REDACTED\]/);
    assert.match(content, /任务：Lexicon Hub 任务/);
    assert.match(content, /状态：/);
    assert.match(content, /执行内容：/);
    assert.match(content, /进度：/);
    assert.match(content, /参数、结果及相关信息：/);
  } finally {
    fs.rmSync(logDirectory, { recursive: true, force: true });
  }
});
