// wordKey 来自词典词条，同一键可能出现在不同分类并对应不同词义。
// 所有收藏 UI 都使用与数据库一致的 (recordId, wordKey) 复合身份。
export const favoriteIdentity = (recordId, wordKey) =>
  JSON.stringify([String(recordId), String(wordKey)]);
