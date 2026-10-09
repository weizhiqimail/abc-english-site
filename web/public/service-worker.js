/**
 * ABC English PWA 实施说明
 * ========================
 *
 * 一、PWA 是什么
 * --------------------------------------------------------------------------
 * PWA（Progressive Web App，渐进式 Web 应用）仍然是网站，但浏览器可以把它安装到
 * 桌面、开始菜单或手机主屏幕，并用接近原生客户端的独立窗口运行。它不需要另外编写
 * Windows/macOS/Android 客户端；页面、路由和 API 仍然复用现有 Web 项目。
 *
 * 二、本项目涉及的文件及职责
 * --------------------------------------------------------------------------
 * 1. web/public/manifest.webmanifest
 *    向浏览器声明应用名称、启动地址、显示模式、主题色和图标。Vite 构建时会将它原样
 *    复制到发布目录根部。此文件是严格 JSON，JSON 语法不允许注释，所以字段说明写在这里：
 *    - name / short_name：安装界面和操作系统应用列表中显示的名称；
 *    - start_url：用户点击已安装应用时首先打开的站内地址；
 *    - scope：PWA 可以控制的 URL 范围；
 *    - display: standalone：隐藏普通浏览器地址栏，以独立应用窗口运行；
 *    - background_color / theme_color：启动画面和浏览器外壳的颜色；
 *    - icons：系统桌面、任务栏和安装对话框使用的应用图标；
 *    - purpose: "any maskable"：图标既可普通显示，也允许系统裁切成圆形等形状。
 *
 * 2. web/index.html
 *    通过 <link rel="manifest"> 把页面与 manifest 关联；theme-color 控制浏览器主题色；
 *    apple-mobile-web-app-* 和 apple-touch-icon 用于改善 iPhone/iPad 的“添加到主屏幕”。
 *
 * 3. web/src/services/pwa.js
 *    负责浏览器页面一侧的 PWA 能力：注册本文件、保存 beforeinstallprompt 安装事件、
 *    主动弹出安装对话框、判断是否处于独立窗口，以及通知 React 页面刷新安装状态。
 *
 * 4. web/src/main.jsx
 *    在前端入口调用 registerServiceWorker()。本项目只在生产构建中注册，避免开发时旧缓存
 *    干扰热更新。修改本文件后，需要重新执行生产构建并部署，线上用户才会收到新版本。
 *
 * 5. web/src/features/settings/SettingsPage.jsx
 *    提供“安装到本机”界面。支持安装事件时按钮会直接调起浏览器安装框；不支持时提示用户
 *    从浏览器菜单选择“安装应用”或“添加到主屏幕”（iOS Safari 通常属于这种情况）。
 *
 * 6. web/public/icons/app-icon.svg
 *    应用图标。更换图标时必须同步检查 manifest 与 index.html 中的路径，并保留适合系统
 *    裁切的安全边距。若目标平台对 SVG 支持不佳，可增加 192×192、512×512 PNG 图标，
 *    再把它们作为额外 icons 项写入 manifest。
 *
 * 三、浏览器从访问网站到完成安装的过程
 * --------------------------------------------------------------------------
 * 1. 用户通过 HTTPS 打开网站（本机 localhost/127.0.0.1 调试通常也被视为安全环境）。
 * 2. index.html 加载 manifest，并由 main.jsx 调用 pwa.js 注册 /service-worker.js。
 * 3. 浏览器下载本文件，在独立的 Worker 线程触发 install 事件，缓存应用外壳和构建资源。
 * 4. install 成功后触发 activate；旧版本缓存被删除，新 Worker 开始控制页面。
 * 5. 浏览器确认 manifest、图标、Service Worker 和安全环境等条件满足后，可能触发
 *    beforeinstallprompt。pwa.js 保存该事件，设置页才可以用按钮主动显示安装框。
 * 6. 用户接受安装后，浏览器/操作系统创建应用入口。以后从该入口打开时，manifest 的
 *    start_url 会在 standalone 窗口中启动。
 * 7. 页面访问仍优先使用网络；断网时，本文件用缓存的入口 HTML 与静态资源完成基础启动。
 *    业务 API 不缓存，所以离线时需要服务器数据的功能仍会失败，这是刻意的数据一致性策略。
 *
 * 四、可安装和部署要求
 * --------------------------------------------------------------------------
 * - 生产环境必须使用 HTTPS；普通 HTTP 站点不能注册 Service Worker（localhost 例外）。
 * - manifest 必须能从 /manifest.webmanifest 正常访问，内容类型和 JSON 语法必须正确。
 * - /service-worker.js 必须位于站点根路径。Service Worker 默认只能控制其所在目录及子目录，
 *   放在根目录才能控制整个 scope: "/" 的单页应用。
 * - 图标路径必须公开可访问；start_url 必须返回应用入口，不能是 404 或登录重定向死循环。
 * - 服务器必须支持 React Router 的 history fallback：非 /api 的前端路由返回 index.html。
 * - “安装”按钮是否直接可用由浏览器决定。已安装、隐身模式、平台不支持、条件尚未满足或
 *   用户近期拒绝安装时，都可能不触发 beforeinstallprompt；此时浏览器菜单仍可能提供安装。
 * - iOS Safari 没有 beforeinstallprompt，通常需使用“分享 → 添加到主屏幕”。
 * - Service Worker 文件不要设置长期 immutable 缓存，否则浏览器可能无法及时发现新版本。
 *
 * 五、开发、发布与验证步骤
 * --------------------------------------------------------------------------
 * 1. 修改 PWA 代码或缓存内容后递增下面的 CACHE_NAME，例如 v1 改成 v2；activate 阶段会
 *    删除旧缓存。若不改版本名，已有同名缓存可能继续保留过期文件。
 * 2. 执行 `npm run web:build`。Vite 会把 web/public 下的文件复制到 server/dist，并生成
 *    带内容哈希的 /assets/*.js 和 /assets/*.css。
 * 3. 部署 server/dist，并确认上述 HTTPS、静态文件与 history fallback 要求。
 * 4. Chrome/Edge 可在开发者工具 Application 中检查 Manifest、Service Workers、Cache
 *    Storage；也可切换 Network 的 Offline 后刷新，验证应用外壳是否仍能显示。
 * 5. 测试新版本时，可在 Application → Service Workers 中注销旧 Worker，并清空站点数据。
 *    不要把“清空浏览器缓存”做成线上业务逻辑，版本升级应由 CACHE_NAME 自动完成。
 *
 * 六、本文件的缓存策略
 * --------------------------------------------------------------------------
 * - 页面导航：Network First。优先取最新 HTML；断网时回退到缓存的根入口，支持前端路由。
 * - 同源静态资源：Cache First。已有缓存立即返回；首次请求成功后写入缓存供后续离线使用。
 * - /api 请求：完全绕过 Service Worker，始终交给网络，避免把登录状态或旧业务数据缓存。
 * - 非 GET 请求和跨域请求：不拦截，降低对提交表单、鉴权和第三方资源行为的影响。
 */

// 缓存版本号也是升级开关。改变预缓存内容或缓存逻辑时应同步递增版本。
const CACHE_NAME = "abc-english-shell-v1";

// 最小应用外壳：入口页、默认启动路由、manifest 和图标必须能在离线时直接取得。
const APP_SHELL = [
  "/",
  "/vocabulary",
  "/manifest.webmanifest",
  "/icons/app-icon.svg",
];

self.addEventListener("install", (event) => {
  // event.waitUntil 会延长 install 生命周期：只有所有缓存工作成功，安装才算完成。
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // addAll 具有整体失败语义；任一必要文件不可访问时，不启用一个残缺的 Worker。
      await cache.addAll(APP_SHELL);

      // Vite 的 JS/CSS 文件名带构建哈希，无法提前硬编码。读取构建后的入口 HTML，提取
      // /assets/ 引用并预缓存，确保用户首次安装后立即断网仍能加载 React 应用。
      const entry = await cache.match("/");
      const html = await entry.text();
      const assetPaths = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)]
        .map((match) => match[1])
        .filter((path) => path.startsWith("/assets/"));

      await cache.addAll(assetPaths);
    }),
  );

  // 不等待旧 Worker 自然退出，安装完成后尽快进入 activate。缓存版本隔离保证切换安全。
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // 仅保留当前版本缓存，防止多次发布积累无用文件占用用户磁盘。
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      // 让新 Worker 立即接管已经打开的页面，而不必等用户下一次重新访问。
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 不处理写操作、跨域资源和业务 API：这些请求继续遵循浏览器原本的网络行为。
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // 浏览器地址栏访问或 React Router 路由刷新属于 navigate 请求。
  // Network First 能优先获得最新版 HTML；网络失败时统一回退到缓存的 SPA 入口，
  // 随后由 React Router 根据当前 URL 渲染正确页面。
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Response 流只能读取一次，因此写缓存前必须 clone，原响应继续返回给页面。
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy));
          return response;
        })
        .catch(() => caches.match("/")),
    );
    return;
  }

  // JS、CSS、图片等同源静态文件采用 Cache First：命中时响应快且可离线；未命中时
  // 访问网络，并把成功响应缓存起来。只缓存 response.ok，避免长期保存 404/500。
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
