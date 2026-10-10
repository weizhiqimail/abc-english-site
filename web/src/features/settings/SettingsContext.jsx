import { createContext, useContext, useEffect, useMemo, useState } from "react";

const SettingsContext = createContext(null);

export const themeOptions = [
  { value: "system", label: "跟随系统" },
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
];

export const fontSizeOptions = Array.from(
  { length: 12 },
  (_, index) => 14 + index * 2,
);

export function SettingsProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem("abc-theme") || "system",
  );
  const [fontSize, setFontSize] = useState(() => {
    const savedSize = Number(localStorage.getItem("abc-content-font-size"));
    return fontSizeOptions.includes(savedSize) ? savedSize : 18;
  });

  useEffect(() => {
    const root = document.documentElement;
    const media = matchMedia("(prefers-color-scheme: dark)");

    // 系统主题会随操作系统实时变化，手动选择则固定在当前浏览器中。
    const applyTheme = () => {
      let resolvedTheme = theme;
      // 跟随系统时才读取媒体查询，手动主题保持用户选择。
      if (theme === "system") {
        resolvedTheme = media.matches ? "dark" : "light";
      }
      root.dataset.theme = resolvedTheme;
    };

    applyTheme();
    media.addEventListener("change", applyTheme);
    localStorage.setItem("abc-theme", theme);
    return () => media.removeEventListener("change", applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--reading-font-size",
      `${fontSize}px`,
    );
    localStorage.setItem("abc-content-font-size", String(fontSize));
  }, [fontSize]);

  const value = useMemo(
    () => ({ theme, setTheme, fontSize, setFontSize }),
    [theme, fontSize],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
