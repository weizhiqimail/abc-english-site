import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_TARGET || "http://127.0.0.1:3211",
        // 保留浏览器访问 Vite 时的 Host，使后端同源校验可以正确识别
        // localhost:5173，而不是把代理目标 127.0.0.1:3211 误判为来源。
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../server/dist"),
    emptyOutDir: true,
    // Service Worker 读取构建清单，将入口、异步路由和各自 CSS 一并加入离线缓存。
    manifest: "asset-manifest.json",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("node_modules/@alifd/next")) return "vendor-fusion";
          if (
            /node_modules\/(react-markdown|unified|remark-|rehype-|micromark|mdast-|hast-)/.test(
              id,
            )
          ) {
            return "vendor-markdown";
          }
          return "vendor";
        },
      },
    },
  },
});
