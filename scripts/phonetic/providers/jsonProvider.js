const fs = require("node:fs/promises");
const { normalizeWord } = require("../core/normalizeWord");

/** 读取合法取得的结构化 JSON/JSONL 音标数据，不抓取词典网页。 */
function createJsonPhoneticProvider(options) {
  let indexPromise;
  async function load() {
    if (!indexPromise) {
      indexPromise = fs.readFile(options.filePath, "utf8").then((text) => {
        const records = text.trim().startsWith("[")
          ? JSON.parse(text)
          : text
              .split(/\r?\n/)
              .filter(Boolean)
              .map((line) => JSON.parse(line));
        const index = new Map();
        for (const record of records) {
          const key = normalizeWord(record.word);
          index.set(key, [...(index.get(key) || []), record]);
        }
        return index;
      });
    }
    return indexPromise;
  }
  return {
    name: options.name || "structured-json",
    async resolve({ word, locale, partOfSpeech }) {
      const records = (await load()).get(normalizeWord(word)) || [];
      return records.filter(
        (item) =>
          (!locale || item.locale === locale) &&
          (!partOfSpeech ||
            !item.partOfSpeech ||
            item.partOfSpeech === partOfSpeech),
      );
    },
  };
}

module.exports = { createJsonPhoneticProvider };
