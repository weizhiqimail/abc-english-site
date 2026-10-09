class AppError extends Error {
  constructor(status, message, code = "INVALID_REQUEST", options = {}) {
    super(message, options);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

function badRequest(message, code) {
  return new AppError(400, message, code);
}

module.exports = { AppError, badRequest };
