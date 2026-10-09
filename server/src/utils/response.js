function safeStatus(status, fallback) {
  return Number.isInteger(status) && status >= 100 && status <= 599
    ? status
    : fallback;
}

exports.ok = (response, data, status = 200) =>
  response
    .status(safeStatus(status, 200))
    .json({ success: true, data: data ?? null, error: null });
exports.fail = (response, status, error, code = null) =>
  response.status(safeStatus(status, 500)).json({
    success: false,
    data: null,
    error: typeof error === "string" && error ? error : "请求失败",
    code,
  });
