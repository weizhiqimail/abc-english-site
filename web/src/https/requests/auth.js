import { get, post } from "../index";

// queryCurrentUser 查询当前 Cookie 对应的登录用户。
export function queryCurrentUser() {
  return get("/auth/me");
}

// loginWithPassword 使用用户名和密码建立登录会话。
export function loginWithPassword(credentials) {
  return post("/auth/login", credentials);
}

// logoutCurrentUser 注销当前会话。
export function logoutCurrentUser() {
  return post("/auth/logout");
}
