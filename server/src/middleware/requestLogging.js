const crypto = require("node:crypto");
const { log, requestContext } = require("../services/errorLogService");

function requestLogging(request, response, next) {
  const incomingId = request.get("x-request-id");
  request.id =
    typeof incomingId === "string" &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(incomingId)
      ? incomingId
      : crypto.randomUUID();
  response.setHeader("x-request-id", request.id);
  const startedAt = process.hrtime.bigint();
  response.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level =
      response.statusCode >= 500
        ? "error"
        : response.statusCode >= 400
          ? "warning"
          : "info";
    log(level, "http.request.completed", {
      ...requestContext(request),
      statusCode: response.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      contentLength: response.getHeader("content-length") || null,
    });
  });
  next();
}

module.exports = requestLogging;
