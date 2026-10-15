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

## 生产 JWT 密钥校验

生产启动必须显式设置 `NODE_ENV=production`（也可在部署平台设置环境变量）：

```bash
NODE_ENV=production npm start --prefix backend
```

运行前先构建后端并注入 `JWT_SECRET`。生产配置拒绝缺失/空值、已知开发默认值与示例占位值、
包含空白的值、少于 32 字节的值，以及单个字符重复组成的值。
校验发生在配置加载阶段，失败时进程以非零状态退出，在连接数据库和监听端口之前停止；错误只提示配置项和规则，不输出密钥内容。

可在自己的终端生成 32 随机字节的十六进制密钥，将输出安全地配置到部署环境：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

不要把生成的值提交到代码仓库、聊天或日志。所有后端实例应使用相同的签名密钥；直接替换密钥会使旧签名的 token 无法通过验证，需要重新登录。
长度检查不能证明随机性，仍须使用安全随机生成的值。开发与测试环境保留原来的本地配置行为；只运行 `npm start` 不会自动切换成生产模式。

独立运行配置测试（不连接数据库、不读取本地 `.env`、不调用 AI）：

```bash
npm run test:config --prefix backend
```

## 模块与整合方式

| 模块                   | 主要能力                                                    |
| ---------------------- | ----------------------------------------------------------- |
| Prompt 资源库 / 工作台 | 搜索、创建、编辑、变量注入、版本恢复、模型调试              |
| AI 对话                | 新建 / 删除 / 搜索会话、多轮流式回复、停止生成              |
| 代码工具               | 解释、翻译、重构、审查、生成测试；翻译传递目标语言          |
| AI 工作流              | 最多 10 个顺序 Prompt 步骤、输入/步骤输出映射、运行/失败重试 |
| 历史记录               | 搜索、详情、复制、Markdown 导出、继续对话、再次运行代码工具 |
| 模型与 API             | 查看配置状态、保存或清除个人密钥                            |

统一外壳与主题位于 `frontend/src/components/layout/AppShell.vue` 和 `frontend/src/styles/theme.css`。对话与生成的异步状态集中到 `frontend/src/composables`；业务展示组件按 `chat`、`code-tool`、`history` 分组。后端继续沿用 routes → controllers → services → models 分层与 `{ code, message, data }` 响应格式。

## 验证命令

```bash
npm test --prefix backend # 需要本机 MongoDB，使用自动清理的独立测试数据库
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

项目状态和接口约定见 `Claude.md`；全栈知识地图与端到端代码流见 `PROJECT_KNOWLEDGE.md`；前端开发约定见 `frontend/README.md`。

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

## 登录凭证撤销（tokenVersion）

JWT 包含用户的 `tokenVersion`；每次受保护请求都会查询用户并比较版本。
`POST /api/auth/logout-all` 使用当前 Bearer token，按认证时的版本原子递增账号版本，
使此前签发的凭证在之后的请求中返回 401。并发到达的同版本退出请求不会重复递增，
避免误撤销重新登录后的凭证。前端退出按钮为「退出全部设备」，撤销成功后才清理本地状态；
网络或服务错误时保留登录状态以便重试，401 仍走统一清理逻辑。

升级后，不带版本号的旧 JWT 必须重新登录；已有用户文档缺少版本字段时按 0 读取，首次退出会写入版本 1，无需批量迁移。
此机制不强制中断已经通过鉴权的请求或已建立的 SSE 流；其他设备在下一次受保护请求时发现失效。
目前未提供密码重置/账号封禁功能；未来接入时可复用版本撤销逻辑。

后端测试使用本机 `127.0.0.1:27017` 的随机 `ai-workbench-auth-test-*` 数据库及临时上传目录，
不读取业务数据库配置、不调用真实 AI，正常结束时自动清理。
覆盖多设备退出、其他用户隔离、重新登录、并发旧退出、旧用户文档、非法/过期 JWT 和数据库异常。


## 头像上传内容校验

`POST /api/auth/avatar` 需要 Bearer token，使用 multipart 表单的单个 `avatar` 文件字段。

- 仅接受声明为 JPEG / PNG / WebP / GIF 的文件，上传体中的文件限制为 2 MiB，不接受额外文件或文本字段。
- 原始文件只暂存在内存。先检查文件签名，再用 Sharp 检查真实格式和尺寸，并严格解码要使用的首帧；伪装文本、SVG、其他格式和无法解码的图片返回 400。
- 文件名和扩展名不参与判定；声明 MIME 与实际格式同属允许列表时，以实际内容为准，例如声明 JPEG 的真实 PNG 可正常处理。
- 输入单边不超过 8192 像素、首帧总像素不超过 1600 万。按 EXIF 方向纠正后，等比例缩小至 512 × 512 范围内，不放大小图。
- GIF 等动图只使用首帧，输出静态 WebP。重新编码时不保留 EXIF（含 GPS）、XMP、ICC 等原图元数据和附加原始内容。
- 只将编码结果写入公开上传目录，使用服务器生成的 UUID 文件名和固定 `.webp` 扩展名。数据库更新失败或用户已不存在时，尝试清理本次新文件；磁盘和数据库故障返回通用服务器错误，解码错误不向客户端输出底层细节。

这些规则只作用于新上传：历史文件不会自动重新处理，替换头像后旧文件也暂不自动删除。
文件系统和数据库之间没有跨系统事务；进程异常退出或清理失败可能留下文件，后续可补定期孤立文件清理。
单次上传大小和图片像素限制不等于并发/频率限制，公开部署仍需单独配置上传限流与存储配额。

## 顺序式 AI 工作流

登录后可在侧栏「AI 工作流」中把已保存的 Prompt 按顺序编排。每个步骤可选择模型，并将模板变量映射到运行时输入或任意前序步骤的输出；运行过程通过 SSE 展示逐步生成结果。

- 每个工作流最多 10 步；保存时会快照所选 Prompt 的内容和版本，工作流更新会递增版本。
- 运行记录保存输入、Prompt/模型版本、逐步输入输出、耗时、可用的 token 用量及失败信息。
- 步骤失败后停止后续调用，保留已完成输出；可从失败步骤重试，之前成功的步骤不会重复调用。用户也可以中止当前运行。
- 删除工作流会同时删除该工作流的运行记录。当前不支持分支、并行、循环、脚本和节点画布。
- API：`GET/POST /api/workflows`、`GET/PUT/DELETE /api/workflows/:id`、`GET /api/workflows/:id/runs`、`POST /api/workflows/:id/runs/stream` 与 `POST /api/workflows/:id/runs/:runId/retry/stream`。所有接口均要求登录。

工作流只引用当前用户拥有的 Prompt；后端按用户隔离读写资源。模型 Key 继续通过既有 Provider 服务获取，不会保存进工作流或运行记录。

运行 `npm test --prefix backend` 会同时验证鉴权、生产密钥配置和头像上传。
头像测试使用随机 `ai-workbench-avatar-test-*` 数据库和临时目录，覆盖真实格式、伪装/损坏文件、字节与像素边界、元数据移除、首帧处理、静态响应以及保存失败清理。
