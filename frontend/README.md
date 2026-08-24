# AI Prompt 工作台 · 前端

Vue 3 + TypeScript + Vite + Element Plus 的前端工程。

## 命令

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器（http://localhost:5173）
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览构建产物
```

## 开发约定

- 组件一律使用组合式 API（`<script setup>`）+ TypeScript
- 未登录访问页面自动跳转 `/login`，登录态保存在 `localStorage`
- 开发环境 `/api` 请求通过 Vite proxy 转发到后端 `http://localhost:3000`
- SSE 流式消费见 `src/utils/sse.ts`：`POST` + `ReadableStream`，**不能用 EventSource**（它只支持 GET）
- 当前阶段服务端只完成 `/api/auth/*`，Prompt 工作台使用本地 Pinia 数据源模拟，后续再替换为真实 API

## 目录结构（要点）

- `src/api` —— 接口封装；`http.ts` 为 Axios 实例，统一注入 token、解包 `{code,message,data}`、401 跳登录
- `src/stores` —— Pinia：`auth` 登录态、`prompt` 本地 Prompt / 版本 / 调用历史数据源
- `src/views` —— 8 个页面：登录 / Prompt 管理 / Prompt 工作台 / 调用历史 / Provider 配置 / AI 对话 / 代码工具 / 历史记录
- `src/utils` —— `variables.ts` 变量提取与渲染、`sse.ts` 流式消费、`markdown.ts` AI 输出渲染

## 依赖后端

当前只要求后端在 `3000` 端口运行，并实现：

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

Prompt / AI / History 相关接口按 `../Claude.md` 后续阶段逐步接入。
