import { get, patch, post, remove } from "../index";

// queryCollections 获取当前用户的收藏夹及收藏内容。
export function queryCollections(config = {}) {
  return get("/collections", {}, config);
}

// createCollection 新建收藏夹。
export function createCollection(name) {
  return post("/collections", { name });
}

// renameCollection 修改收藏夹名称。
export function renameCollection(collectionId, name) {
  return patch(`/collections/${collectionId}`, { name });
}

// deleteCollection 删除收藏夹及其中的收藏关系。
export function deleteCollection(collectionId) {
  return remove(`/collections/${collectionId}`);
}

// addFavorite 将一个词汇加入指定收藏夹。
export function addFavorite(collectionId, favoriteData, config = {}) {
  return post(`/collections/${collectionId}/favorites`, favoriteData, config);
}

// deleteFavorite 根据稳定词汇标识移除收藏关系。
export function deleteFavorite(collectionId, wordKey, recordId, config = {}) {
  return remove(
    `/collections/${collectionId}/favorites/${encodeURIComponent(wordKey)}`,
    { recordId },
    config,
  );
}
