/** 只生成检索键，不修改最终展示的原始词汇。 */
function normalizeWord(word) {
  return String(word || "")
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("en");
}

module.exports = { normalizeWord };
