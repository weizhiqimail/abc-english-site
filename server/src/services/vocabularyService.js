// 线上词汇数据只有 PostgreSQL 一个事实来源。保持此门面文件，让路由层无需了解具体存储实现。
module.exports = require("./postgresVocabularyService");
