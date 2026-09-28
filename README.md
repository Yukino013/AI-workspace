# AI 开发者工作台

基于 Vue 3、TypeScript、Element Plus、Express 和 MongoDB，整合 Prompt 调试、多轮 AI 对话、代码工具与历史复用。

## 启动项目

需要 Node.js、npm 和可用的 MongoDB。前后端分别管理依赖。

```bash
# 项目根目录
npm install --prefix backend
npm install --prefix frontend

# 仅首次配置；不要覆盖已有 .env
cp -n backend/.env.example backend/.env
```

在 `backend/.env` 中设置 MongoDB 地址、随机 JWT 密钥及模型服务。也可登录后在「模型与 API」配置个人 API Key；密钥由后端接收，不写入前端源码。

分别在两个终端启动：

```bash
# 终端一
cd backend
npm run dev

# 终端二
cd frontend
npm run dev
```

访问 `http://localhost:5173`。后端默认端口为 `3000`，开发代理将 `/api` 转发到后端。首次使用可在登录页注册。自定义 API 地址时，为前端设置 `VITE_API_BASE_URL`，包括 `/api` 路径。

## 模块与整合方式

| 模块 | 主要能力 |
| --- | --- |
| Prompt 资源库 / 工作台 | 搜索、创建、编辑、变量注入、版本恢复、模型调试 |
| AI 对话 | 新建 / 删除 / 搜索会话、多轮流式回复、停止生成 |
| 代码工具 | 解释、翻译、重构、审查、生成测试；翻译传递目标语言 |
| 历史记录 | 搜索、详情、复制、Markdown 导出、继续对话、再次运行代码工具 |
| 模型与 API | 查看配置状态、保存或清除个人密钥 |

统一外壳与主题位于 `frontend/src/components/layout/AppShell.vue` 和 `frontend/src/styles/theme.css`。对话与生成的异步状态集中到 `frontend/src/composables`；业务展示组件按 `chat`、`code-tool`、`history` 分组。后端继续沿用 routes → controllers → services → models 分层与 `{ code, message, data }` 响应格式。

## 验证命令

```bash
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run build --prefix frontend
npm run build --prefix backend
```

回归测试使用 Node 原生测试运行器，借助 Vite 已安装的 esbuild 加载实际 TypeScript 模块。覆盖 SSE 分片、UTF-8、CRLF、结束标记、异常断流、取消、401，以及 Markdown 换行、代码围栏和导出文件名。

## 无真实 AI 调用的隔离联调

`scripts/qa-server.mjs` 使用真实后端与本机 MongoDB，但将 AI 请求指向本地模拟服务。用于验证 UI → API → 持久化 → SSE 链路，不消耗模型额度。

前提：本机 MongoDB 在 `127.0.0.1:27017`，`3000` 端口空闲。不要与正式开发后端同时运行。

```bash
npm run build --prefix backend
node scripts/qa-server.mjs
# 另开终端运行前端
npm run dev --prefix frontend
```

测试账号：`qa_developer`，密码：`qa-test-2026`。脚本创建带时间戳的 `ai-workbench-refactor-qa-*` 独立数据库和示例 Prompt，不使用业务数据库。

使用 Ctrl+C 正常退出时，只清理本次进程创建的数据库。强制杀进程或断电可能遗留测试数据库；手动清理前应核对脚本输出的完整库名。测试账号、JWT 密钥与模拟响应仅供本地联调，不能用于生产。

建议回归顺序：

1. 登录、切换主题，检查桌面和窄屏导航。
2. 创建 Prompt，修改后直接运行应提示先保存；保存后运行并检查版本。
3. 代码翻译指定 Python，查看输出与历史，再次运行时应恢复语言及代码。
4. 对话中验证中文输入法确认不误发送，生成过程中切换或新建会话不应串流。
5. 历史记录搜索、详情、Markdown 导出与复用。

## 当前验证边界

- 本轮联调使用本地模拟 AI；真实 Provider 的网络、鉴权、限流与账单行为需用实际账号另行验证。
- 停止生成会取消前端请求；部分输出不代表已完整持久化，也不能保证上游立即停止计费。
- 历史查询改为批量读取消息，避免逐会话查询；当前仍在内存中整合分页，大数据量下应继续改进数据库侧分页。
- Element Plus 当前全量注册，生产构建仍可能提示主包较大，本轮未以拆包掩盖此问题。

详细架构约定见 `AGENTS.md`，前端开发约定见 `frontend/README.md`。

## Apple Silicon：Node 架构与原生依赖

安装依赖与启动服务应使用同一套 Node。若看到 esbuild 的 `darwin-x64` / `darwin-arm64` 不匹配报错，先检查：

```bash
which -a node npm
node -p 'process.version + " / " + process.arch + " / " + process.execPath'
```

Apple Silicon 的原生终端应输出 `arm64`。如使用 nvm，先切换到已安装的 ARM64 Node（例如 `nvm use 22`），再在报错的前端或后端目录按锁文件重装依赖：

```bash
npm ci --include=optional
npm run dev
```

`npm ci` 会重建当前目录的 `node_modules`，不修改锁文件。不要在 x64 与 ARM64 Node 之间交替安装同一个依赖目录，也不要把某个架构的 esbuild 包写成项目固定依赖；这些包应由包管理器按当前运行环境选择。

## UI 迭代：独立端口验收

新的外壳、Prompt 卡片库、居中对话输入区和快捷导航采用统一蓝灰设计系统。为了不影响正在运行的服务，隔离测试也支持指定端口：

```bash
# 终端 1；先确保 backend/dist 已构建且本地 MongoDB 可用
QA_PORT=3001 node scripts/qa-server.mjs

# 终端 2
DEV_API_TARGET=http://127.0.0.1:3001 npm run dev --prefix frontend -- --host 127.0.0.1 --port 5188 --strictPort
```

该入口依然只创建独立测试数据库、调用本地模拟 AI；正常结束时 Ctrl+C 清理。新增界面回归项：资源库卡片／列表、搜索结果、快捷导航键盘操作、侧栏收起、移动导航焦点循环、对话建议填入与发送、深浅主题和窄屏横向溢出。
