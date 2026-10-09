let activeRequests = 0;

export const getActiveRequestCount = () => activeRequests;

function updateGlobalLoading(change) {
  activeRequests = Math.max(0, activeRequests + change);
  // 所有接口共享同一个计数，多个并发请求结束前 Loading 不会提前消失。
  window.dispatchEvent(
    new CustomEvent("abc:api-loading", { detail: activeRequests }),
  );
}

export async function api(path, options = {}) {
  const { globalLoading = true, ...fetchOptions } = options;
  if (globalLoading) updateGlobalLoading(1);
  try {
    const response = await fetch(`/api${path}`, {
      credentials: "include",
      headers: fetchOptions.body
        ? { "Content-Type": "application/json", ...fetchOptions.headers }
        : fetchOptions.headers,
      ...fetchOptions,
    });
    const payload = await response
      .json()
      .catch(() => ({ success: false, error: "服务器响应格式错误" }));
    if (!response.ok || !payload.success) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }
    return payload.data;
  } finally {
    if (globalLoading) updateGlobalLoading(-1);
  }
}

// GET 也透传 AbortSignal 等 fetch 选项。页面切换时可以取消旧请求，避免过期响应覆盖新状态。
export const get = (path, options = {}) => api(path, options);
export const post = (path, body, options = {}) =>
  api(path, { ...options, method: "POST", body: JSON.stringify(body) });
export const patch = (path, body, options = {}) =>
  api(path, { ...options, method: "PATCH", body: JSON.stringify(body) });
export const remove = (path, options = {}) =>
  api(path, { ...options, method: "DELETE" });
