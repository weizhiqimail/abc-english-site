import { get } from "../index";

// queryVocabularyOverview 获取各 CEFR 等级的主题与词汇统计。
export function queryVocabularyOverview() {
  return get("/overview");
}

// queryLevelCategories 获取指定等级的词汇分类。
export function queryLevelCategories(level) {
  return get(`/vocabulary/levels/${encodeURIComponent(level)}`);
}

// queryCategoryDetail 获取单个分类的元数据、词卡和相邻分类。
export function queryCategoryDetail(recordId, config = {}) {
  return get(
    `/vocabulary/categories/${encodeURIComponent(recordId)}`,
    {},
    config,
  );
}

// searchVocabulary 使用 params 交给 Axios 编码，组件不直接拼接 URL。
export function searchVocabulary(queryStr, config = {}) {
  return get("/search", { q: queryStr }, config);
}
