function safeStatus(status, fallback) {
  // 只有合法 HTTP 状态码才能传给 Express，其他输入回退到调用方默认值。
  if (Number.isInteger(status) && status >= 100 && status <= 599) {
    return status;
  }
  return fallback;
}

// ok 输出统一的成功响应结构。
exports.ok = (response, data, status = 200) => {
  return response
    .status(safeStatus(status, 200))
    .json({ success: true, data: data ?? null, error: null });
};

// fail 输出统一的失败响应结构，并确保错误消息始终可读。
exports.fail = (response, status, error, code = null) => {
  const errorMessage = typeof error === "string" && error ? error : "请求失败";
  return response.status(safeStatus(status, 500)).json({
    success: false,
    data: null,
    error: errorMessage,
    code,
  });
};
