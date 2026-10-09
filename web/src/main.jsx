import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// 只引入项目实际使用的 Fusion Next 组件样式，避免把整套组件库 CSS 放进入口包。
import "@alifd/next/lib/button/index.css";
import "@alifd/next/lib/checkbox/index.css";
import "@alifd/next/lib/dialog/index.css";
import "@alifd/next/lib/icon/index.css";
import "@alifd/next/lib/input/index.css";
import "@alifd/next/lib/message/index.css";
import "./styles/global.css";
import App from "./app/App";
import { AuthProvider } from "./features/auth/AuthContext";
import { SettingsProvider } from "./features/settings/SettingsContext";
import { registerServiceWorker } from "./services/pwa";

// 尽早建立安装事件监听，并安排页面加载完成后注册 Service Worker。
// registerServiceWorker 内部会跳过 Vite 开发环境，生产构建才启用离线能力。
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <SettingsProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SettingsProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
