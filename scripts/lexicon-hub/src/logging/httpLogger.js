const crypto = require("node:crypto");

function createHttpLogger(logger) {
  return function httpLogger(request, response, next) {
    const startedAt = process.hrtime.bigint();
    const requestId = request.get("x-request-id") || crypto.randomUUID();
    request.log = logger.child({ requestId });
    response.setHeader("x-request-id", requestId);
    request.log.info("http.request.started", {
      method: request.method,
      url: request.originalUrl,
      routeParameters: request.params,
      query: request.query,
      body: request.body,
      headers: request.headers,
      remoteAddress: request.ip,
    });
    response.once("finish", () => {
      request.log.info("http.request.completed", {
        method: request.method,
        url: request.originalUrl,
        statusCode: response.statusCode,
        responseBytes: response.getHeader("content-length") || null,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      });
    });
    response.once("close", () => {
      if (!response.writableFinished) {
        request.log.warn("http.request.aborted", {
          method: request.method,
          url: request.originalUrl,
          durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
        });
      }
    });
    next();
  };
}

module.exports = { createHttpLogger };
