const authService = require("../services/authService");
const { authCookieName } = require("../config");
const { fail } = require("../utils/response");
const { assertMethods } = require("../utils/contracts");

assertMethods(authService, "authService", ["authenticate"]);

async function optionalAuth(request, _response, next) {
  try {
    request.user = await authService.authenticate(
      request.cookies?.[authCookieName],
    );
    next();
  } catch (error) {
    next(error);
  }
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
