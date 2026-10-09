/**
 * 页面线程中的 PWA 协调模块。
 *
 * Service Worker 运行在独立 Worker 环境，不能直接操作 React；本模块运行在普通页面中，
 * 将浏览器安装事件转换成 React 可以订阅的状态，并负责注册 public/service-worker.js。
 */

// 浏览器只允许在 beforeinstallprompt 事件有效期内主动显示安装框，因此先保存事件对象。
// 页面刷新后该值会丢失，浏览器满足条件时会在新页面生命周期中再次触发事件。
let deferredInstallPrompt = null;

// 使用自定义 DOM 事件解耦浏览器事件与 React 组件，避免这个通用模块依赖 React。
const notifyInstallState = () => {
  window.dispatchEvent(new Event("abc:install-state"));
};

window.addEventListener("beforeinstallprompt", (event) => {
  // 阻止浏览器自行选择时机弹框，改由设置页的“立即安装”按钮触发。
  event.preventDefault();
  deferredInstallPrompt = event;
  notifyInstallState();
});

window.addEventListener("appinstalled", () => {
  // 安装完成后旧 prompt 不能再次使用，清空并通知界面显示“已安装”。
  deferredInstallPrompt = null;
  notifyInstallState();
});

export function isAppInstalled() {
  // Chromium 等浏览器使用 display-mode；navigator.standalone 是 iOS Safari 的兼容判断。
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

export function canInstallApp() {
  // 有待处理的 prompt 才能由代码直接安装；false 不一定代表浏览器菜单也不能安装。
  return Boolean(deferredInstallPrompt);
}

export function subscribeToInstallState(listener) {
  // 返回清理函数，供 React useEffect 在组件卸载时移除监听，避免重复订阅和内存泄漏。
  window.addEventListener("abc:install-state", listener);
  return () => window.removeEventListener("abc:install-state", listener);
}

export async function installApp() {
  if (!deferredInstallPrompt) {
    // iOS 或浏览器尚未触发事件时，由调用方提示用户改用浏览器菜单。
    return "unavailable";
  }

  // prompt() 必须由用户点击等手势直接触发，否则浏览器会出于防骚扰策略阻止弹框。
  await deferredInstallPrompt.prompt();
  // userChoice 返回 accepted 或 dismissed；两种结果都表示本次 prompt 已消耗。
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  notifyInstallState();
  return outcome;
}

export function registerServiceWorker() {
  // 不支持 Service Worker 的浏览器保持普通网站体验。
  // 开发模式禁用注册，避免缓存旧 bundle，影响 Vite 热更新和问题排查。
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener("load", () => {
    // 等页面 load 后再注册，避免首次渲染关键资源与 Worker 安装争抢网络。
    // 根路径使其默认控制整个站点；生产环境需要 HTTPS（localhost 调试例外）。
    navigator.serviceWorker.register("/service-worker.js").catch((error) => {
      // 注册失败不应阻止网站运行，只记录错误供部署排查。
      console.error("Service Worker 注册失败", error);
    });
  });
}
