const express = require("express");
const authService = require("../services/authService");
const { authCookieName, tokenMaxAgeMs, isProduction } = require("../config");
const { ok, fail } = require("../utils/response");
const asyncRoute = require("../utils/asyncRoute");
const {
  assertAllowedKeys,
  requirePlainObject,
  requiredString,
} = require("../utils/validation");
const { createRateLimit } = require("../middleware/security");
const { assertMethods } = require("../utils/contracts");

assertMethods(authService, "authService", ["login", "logout"]);

const router = express.Router();
const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maximum: 20,
  keyPrefix: "login",
});
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: isProduction,
  maxAge: tokenMaxAgeMs,
  path: "/",
};

router.post(
  "/login",
  loginRateLimit,
  asyncRoute(async (request, response) => {
    const body = requirePlainObject(request.body);
    assertAllowedKeys(body, ["username", "password"]);
    const username = requiredString(body.username, {
      label: "用户名",
      minLength: 1,
      maxLength: 80,
    });
    const password = requiredString(body.password, {
      label: "密码",
      trim: false,
      minLength: 1,
      maxLength: 255,
    });
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
