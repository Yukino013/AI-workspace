import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // 开发环境把 /api 转发到后端 Express（3000 端口）
      "/api": {
        target: process.env.DEV_API_TARGET || "http://localhost:3000",
        changeOrigin: true,
      },
      // 头像等上传文件的静态资源，同样转发到后端
      "/uploads": {
        target: process.env.DEV_API_TARGET || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
