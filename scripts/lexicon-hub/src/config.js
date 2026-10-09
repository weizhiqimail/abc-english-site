const path = require("node:path");

function loadConfig() {
  const privateWorkspaceRoot = path.resolve(
    process.env.ABC_ENGLISH_PRIVATE_ROOT ||
      "D:\\program\\abc-english-site-private",
  );
  return {
    host: process.env.LEXICON_HUB_HOST || "127.0.0.1",
    port: Number(process.env.LEXICON_HUB_PORT || 3220),
    // 本地维护任务必须以这里为唯一数据根目录，不得回读公开仓库。
    privateWorkspaceRoot,
    privateScriptsRoot: path.join(privateWorkspaceRoot, "scripts"),
    pageSize: Math.min(
      200,
      Math.max(10, Number(process.env.LEXICON_HUB_PAGE_SIZE || 50)),
    ),
    phoneticFiles: (process.env.PHONETIC_DATA_FILES || "")
      .split(path.delimiter)
      .map((item) => item.trim())
      .filter(Boolean),
    imageAllowedHosts: (
      process.env.LEXICON_IMAGE_ALLOWED_HOSTS || "cdn.langeek.co"
    )
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
    imageMaxBytes: Math.max(
      1024,
      Number(process.env.LEXICON_IMAGE_MAX_BYTES || 10 * 1024 * 1024),
    ),
  };
}
module.exports = { loadConfig };
