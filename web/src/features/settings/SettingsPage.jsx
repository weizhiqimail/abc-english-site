import { useEffect, useState } from "react";
import { Button, Message } from "@alifd/next";
import { useSettings, fontSizeOptions, themeOptions } from "./SettingsContext";
import {
  canInstallApp,
  installApp,
  isAppInstalled,
  subscribeToInstallState,
} from "../../services/pwa";

export default function SettingsPage() {
  const { theme, setTheme, fontSize, setFontSize } = useSettings();

  // installed 表示当前页面是否已经运行在独立应用窗口；installable 表示浏览器是否提供了
  // 可由代码调用的安装提示。两者含义不同：iOS 可能可手动安装，但 installable 仍为 false。
  const [installed, setInstalled] = useState(isAppInstalled);
  const [installable, setInstallable] = useState(canInstallApp);

  // beforeinstallprompt 和 appinstalled 都可能在组件挂载后发生，因此订阅统一状态事件。
  // useEffect 返回的取消订阅函数会在离开设置页时自动执行。
  useEffect(
    () =>
      subscribeToInstallState(() => {
        setInstalled(isAppInstalled());
        setInstallable(canInstallApp());
      }),
    [],
  );

  const handleInstall = async () => {
    // 用户点击是浏览器允许弹出安装框所要求的“用户手势”。
    const outcome = await installApp();
    if (outcome === "accepted") {
      Message.success("安装已开始，完成后可从桌面或应用列表启动。");
    } else if (outcome === "unavailable") {
      Message.notice("请使用浏览器菜单中的“安装应用”或“添加到主屏幕”。");
    }
  };

  return (
    <section className="content-width settings-page">
      <header className="settings-header">
        <p className="eyebrow">SETTINGS</p>
        <h1>显示设置</h1>
        <p>设置会保存在当前浏览器中，并立即应用到所有页面。</p>
      </header>

      <div className="settings-panel">
        <label className="setting-row">
          <span>
            <strong>主题</strong>
            <small>选择浅色、深色或跟随系统。</small>
          </span>
          <select
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
          >
            {themeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="setting-row">
          <span>
            <strong>阅读字号</strong>
            <small>影响解释、其他含义、词性、构词、类别和例句。</small>
          </span>
          <select
            value={fontSize}
            onChange={(event) => setFontSize(Number(event.target.value))}
          >
            {fontSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
          </select>
        </label>

        <div className="setting-row app-install-row">
          <span>
            <strong>安装到本机</strong>
            <small>
              {installed
                ? "当前已作为独立应用运行。"
                : "安装后可从桌面或应用列表启动，并支持基础离线打开。"}
            </small>
          </span>
          {/*
            已安装时禁用按钮；有 beforeinstallprompt 时直接安装；否则保留入口并告知用户
            从浏览器菜单手动安装，而不是错误地隐藏功能。
          */}
          <Button type="primary" disabled={installed} onClick={handleInstall}>
            {installed ? "已安装" : installable ? "立即安装" : "查看安装方式"}
          </Button>
        </div>

        <div className="settings-preview" style={{ fontSize: `${fontSize}px` }}>
          <strong>alarm clock · 闹钟</strong>
          <p>这是当前字号的解释、词性和例句预览。</p>
        </div>
      </div>
    </section>
  );
}
