import axios from "axios";

// activeRequestCount 记录仍在等待响应的请求数，用于保证并发请求期间全局 Loading 不会提前消失。
let activeRequestCount = 0;

// httpService 是前端唯一允许访问后端 URL 的 Axios 实例，统一限定 API 前缀、Cookie 和超时时间。
const httpService = axios.create({
  baseURL: "/api",
  timeout: 15_000,
  withCredentials: true,
});

// notifyLoadingState 将当前请求数广播给布局组件，不让业务组件关心全局 Loading 的实现。
function notifyLoadingState(change) {
  activeRequestCount = Math.max(0, activeRequestCount + change);
  window.dispatchEvent(
    new CustomEvent("abc:api-loading", { detail: activeRequestCount }),
  );
}

// shouldUseGlobalLoading 明确判断调用方是否关闭了全局 Loading；只有显式 false 才关闭。
function shouldUseGlobalLoading(config = {}) {
  return config.globalLoading !== false;
}

// 请求拦截器只在需要全局反馈时增加计数，并把内部配置从 Axios 请求参数中移除。
httpService.interceptors.request.use((config) => {
  const useGlobalLoading = shouldUseGlobalLoading(config);
  config.useGlobalLoading = useGlobalLoading;
  delete config.globalLoading;
  if (useGlobalLoading) {
    notifyLoadingState(1);
  }
  return config;
});

// finishRequest 对成功和失败响应执行同一套计数收尾，避免 Loading 状态泄漏。
function finishRequest(config = {}) {
  if (config.useGlobalLoading) {
    notifyLoadingState(-1);
  }
}

// 成功响应只向业务层暴露 data，保持所有请求方法返回值一致。
httpService.interceptors.response.use(
  (response) => {
    finishRequest(response.config);
    const payload = response.data;
    if (!payload?.success) {
      throw new Error(payload?.error || "服务器响应格式错误");
    }
    return payload.data;
  },
  (requestError) => {
    finishRequest(requestError.config);
    if (axios.isCancel(requestError)) {
      requestError.name = "AbortError";
      return Promise.reject(requestError);
    }
    const errorMessage =
      requestError.response?.data?.error || requestError.message || "请求失败";
    return Promise.reject(new Error(errorMessage));
  },
);

// getActiveRequestCount 为布局首次挂载时提供当前请求快照。
export function getActiveRequestCount() {
  return activeRequestCount;
}

// 以下基础方法是 requests 目录与 Axios 实例之间的唯一桥梁。
export function get(url, params = {}, config = {}) {
  return httpService.get(url, { ...config, params });
}

export function post(url, data = {}, config = {}) {
  return httpService.post(url, data, config);
}

export function patch(url, data = {}, config = {}) {
  return httpService.patch(url, data, config);
}

export function remove(url, params = {}, config = {}) {
  return httpService.delete(url, { ...config, params });
}
