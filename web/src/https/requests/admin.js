import { get, patch, post, remove } from "../index";

// queryDatabaseOverview 获取管理员可浏览的数据表及各表记录数。
export function queryDatabaseOverview() {
  return get("/admin/database");
}

// queryDatabaseTable 获取指定表的分页数据；tableKey 来自概览接口，不在组件中拼接查询串。
export function queryDatabaseTable(tableKey, params = {}) {
  return get(`/admin/database/${encodeURIComponent(tableKey)}`, params);
}

// queryUsers 获取后台用户列表。
export function queryUsers() {
  return get("/admin/users");
}

// createUser 创建普通用户。
export function createUser(userData) {
  return post("/admin/users", userData);
}

// updateUser 更新指定用户的可编辑资料。
export function updateUser(userId, userData) {
  return patch(`/admin/users/${userId}`, userData);
}

// deleteUser 永久删除指定普通用户及其关联数据。
export function deleteUser(userId) {
  return remove(`/admin/users/${userId}`);
}
