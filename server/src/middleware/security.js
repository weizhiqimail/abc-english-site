const { fail } = require("../utils/response");

const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function securityHeaders(_request, response, next) {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("referrer-policy", "same-origin");
  response.setHeader(
    "permissions-policy",
    "camera=(), microphone=(), geolocation=()",
  );
  next();
}

function sameOriginMutations(request, response, next) {
  if (!mutationMethods.has(request.method)) return next();
  const origin = request.get("origin");
  if (!origin) return next();
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return fail(response, 403, "请求来源无效", "INVALID_ORIGIN");
  }
  const forwardedHost = request.get("x-forwarded-host");
  const expectedHost = (forwardedHost || request.get("host") || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (!expectedHost || parsed.host.toLowerCase() !== expectedHost) {
    return fail(response, 403, "不允许跨站修改数据", "ORIGIN_MISMATCH");
  }
  next();
}

function createRateLimit({ windowMs, maximum, keyPrefix }) {
  const buckets = new Map();
  return function rateLimit(request, response, next) {
    const now = Date.now();
    const key = `${keyPrefix}:${request.ip || "unknown"}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > maximum) {
      response.setHeader(
        "retry-after",
        String(Math.ceil((current.resetAt - now) / 1000)),
      );
      return fail(response, 429, "请求过于频繁，请稍后重试", "RATE_LIMITED");
    }
    if (buckets.size > 10_000) {
      for (const [bucketKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    next();
  };
}

module.exports = { createRateLimit, sameOriginMutations, securityHeaders };
