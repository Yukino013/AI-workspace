# AI Prompt 工作台 · 前端

Vue 3 + TypeScript + Vite + Element Plus 的前端工程。

## 命令

```bash
npm install        # 安装依赖
npm run dev        # 启动开发服务器（http://localhost:5173）
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览构建产物
npm run typecheck  # Vue / TypeScript 类型检查
npm test           # SSE 与历史导出的回归测试
```

## 开发约定

- 组件一律使用组合式 API（`<script setup>`）+ TypeScript
- 未登录访问页面自动跳转 `/login`，登录态保存在 `localStorage`
- 开发环境 `/api` 请求通过 Vite proxy 转发到后端 `http://localhost:3000`
- SSE 流式消费见 `src/utils/sse.ts`：`POST` + `ReadableStream`，**不能用 EventSource**（它只支持 GET）
- 当前前端已通过 Axios 接入真实后端，覆盖认证、Prompt 工作台、Provider 配置、AI 对话、代码工具、调用历史和统一历史记录；Prompt 列表支持一键复制模板，历史记录支持继续对话、再次运行代码工具、复制输入/结果和导出 Markdown，SSE 流式请求统一使用 `src/utils/sse.ts`

## 目录结构（要点）

- `src/api` —— 接口封装；`http.ts` 为 Axios 实例，统一注入 token、解包 `{code,message,data}`、401 跳登录
- `src/stores` —— Pinia：`auth` 登录态、`prompt` 当前编辑项 / 模型 / 运行态；业务数据通过 API 持久化
- `src/views` —— 页面：登录 / Prompt 管理 / Prompt 工作台 / 调用历史 / Provider 配置 / AI 对话 / 代码工具 / 历史记录 / 个人资料
- `src/components/layout` —— 响应式侧栏、移动导航和工作区外壳
- `src/components/chat`、`code-tool`、`history` —— 按业务拆分的展示组件
- `src/composables` —— 主题管理、流式生成生命周期、会话加载与切换
- `src/styles/theme.css` —— 浅色 / 深色设计变量和通用样式
- `src/utils` —— `variables.ts` 变量提取与渲染、`sse.ts` 流式消费、`markdown.ts` AI 输出渲染、`clipboard.ts` 跨浏览器复制、`history-export.ts` Markdown 导出

## 依赖后端

后端需要在 `3000` 端口运行，并提供以下接口组：

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

此外还需要挂载 `/api/prompts`、`/api/chat`、`/api/chat-records`、`/api/providers`、`/api/conversations`、`/api/code-tools` 和 `/api/history`。接口均要求先登录并携带 `Authorization: Bearer <token>`，具体请求和响应契约见 [`../Claude.md`](../Claude.md)。

## 本次整合的行为约定

- 主题持久化；窄屏使用抽屉导航，支持 Escape 关闭和焦点管理。
- Prompt 必须保存后才能运行；内容修改未保存时明确提示，避免运行后端旧版本。
- 切换会话、停止生成或离开页面会取消前端流式消费，旧请求不得覆盖新会话。
- 代码翻译必须指定目标语言；从历史记录再次运行时恢复代码、模型及语言。
- SSE 收到 `[DONE]` 才认定正常完成；意外断流、错误响应和登录失效分别处理。
- Axios 与 SSE 均支持 `VITE_API_BASE_URL`（默认 `/api`）；配置值应包含 API 路径。修改后需重启 Vite 或重新构建。

全栈启动、隔离联调和验证边界见项目根目录的 `README.md`。

## Harness 风格的界面设计

- 采用冷灰侧栏、蓝色强调、白色内容画布与大留白，暗色对应石墨灰。品牌图形为本项目原创 SVG，不依赖外部字体或图片服务。
- `LibraryHero` 与 `PromptCard` 负责资源库展示；卡片／列表切换保留同一份搜索和分页数据。
- `ChatWelcome`、`ChatComposer` 与会话侧栏分离；无消息时居中输入，有消息时切换为窄栏阅读布局。会话列表按需展开。
- `CommandPalette` 支持 `⌘/Ctrl + K`、方向键、Enter 和 Escape；只搜索功能入口，不宣称搜索业务数据。
- 全局设计变量仍集中在 `styles/theme.css`；所有核心布局适配深浅主题、窄屏和减少动态效果偏好。
- 本地独立联调可设置 `DEV_API_TARGET=http://127.0.0.1:3001 npm run dev -- --port 5188 --strictPort`，避免占用日常开发服务。默认 API 代理仍为 `3000`。

## DeepSeek 大肥鲸桌宠

登录后的工作台内置原创蓝色鲸鱼悬浮桌宠（网页内陪伴组件，非系统级桌面程序）：

- 点击鲸鱼互动，气泡内可喷水、休息／唤醒、前往 AI 对话。
- 鼠标或触摸拖动改变位置；聚焦鲸鱼后方向键移动，`Shift + 方向键` 加速。
- `Escape` 关闭气泡，再按可收起桌宠；顶栏鲸鱼按钮可随时显示／收起。
- 桌面端默认显示，手机端首次默认隐藏；位置、显示与休息状态保存在本机 `localStorage` 的 `ai-workbench:whale-pet:v1`，清除此项即可重置。
- 兼容深浅色与减少动态效果设置；打开快捷搜索或移动端导航时临时隐藏。
- 互动文案是本地预设，不发送 AI 请求、不读取聊天内容、不消耗模型额度。
