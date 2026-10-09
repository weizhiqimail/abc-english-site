const express = require("express");
const authService = require("../services/authService");
const { authCookieName, tokenMaxAgeMs, isProduction } = require("../config");
const { ok, fail } = require("../utils/response");
const asyncRoute = require("../utils/asyncRoute");

const router = express.Router();
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  maxAge: tokenMaxAgeMs,
  path: "/",
};

router.post(
  "/login",
  asyncRoute(async (request, response) => {
    const username = String(request.body?.username || "").trim();
    const password = String(request.body?.password || "");
    if (!username || !password) {
      return fail(response, 400, "请输入用户名和密码");
    }
    const result = await authService.login(username, password);
    if (!result) {
      return fail(response, 401, "用户名或密码错误");
    }
    response.cookie(authCookieName, result.token, cookieOptions);
    ok(response, { user: result.user, expiresAt: result.expiresAt });
  }),
);

router.post(
  "/logout",
  asyncRoute(async (request, response) => {
    await authService.logout(request.cookies?.[authCookieName]);
    response.clearCookie(authCookieName, { path: "/" });
    ok(response, { loggedOut: true });
  }),
);

router.get("/me", (request, response) =>
  ok(response, { user: request.user || null }),
);

module.exports = router;
