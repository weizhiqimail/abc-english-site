const authService = require("../services/authService");
const { authCookieName } = require("../config");
const { fail } = require("../utils/response");

async function optionalAuth(request, _response, next) {
  // 没有认证 Cookie 时直接保持匿名身份，公开词汇接口仍可正常访问。
  request.user = await authService.authenticate(
    request.cookies?.[authCookieName],
  );
  next();
}

function requireAuth(request, response, next) {
  if (!request.user) {
    return fail(response, 401, "请先登录");
  }
  next();
}

function requireAdmin(request, response, next) {
  if (!request.user) {
    return fail(response, 401, "请先登录");
  }
  if (request.user.role !== "admin") {
    return fail(response, 403, "需要管理员权限");
  }
  next();
}

module.exports = { optionalAuth, requireAuth, requireAdmin };
