# AI 工作台开发文档

> 面向开发者的 AI 开发工具（Prompt 工作台 + AI 对话 + 代码工具 + 历史记录）
> 核心目标：通过一个完整项目掌握 `Vue 3 + Express + MongoDB + AI API + SSE + JWT + 第三方 API 封装`

---

## 开发状态与约定

**当前状态**：主链路闭环已完成——后端 Day 1–6（注册/登录 + Prompt CRUD + 版本 + 调用历史 + AI Adapter/DeepSeek/Qwen + SSE 流式），前端 Prompt 工作台已从内存 mock 切换到真实后端。剩余 Day 8–10（Provider / AI 对话 / 代码工具 / 统一历史记录）待实现。本文档既是开发设计文档，也是本项目的 CLAUDE.md，后续开发一律以本文档为准。

**前端约定**：

- Vue 3 组合式 API（`<script setup>`）+ TypeScript，不用 Options API
- 脚手架基于 Vite；前端端口 `5173`，通过 Vite proxy 把 `/api` 转发到后端 `3000`
- 页面为 8 个（见第 14 章）；状态管理用 Pinia
- AI 输出用 markdown-it 渲染；Axios 封装统一注入 token（见第 10 章）

**后端约定**：

- Express 分层：routes → controllers → services → models
- 统一响应 `{ code, message, data }`，错误码以第 9 章为准
- 参数校验用 Zod；密码用 bcryptjs；鉴权用 JWT（见第 7.1 / 11 章）

**四大并列功能模块**（Prompt 功能保持不变，新增三项并列）：

1. **Prompt 工作台**（原有，见 7.2–7.8）
2. **AI 对话**（新增，见 7.9）
3. **代码工具**（新增，见 7.10）
4. **历史记录**（新增，见 7.11）

**命令**：`frontend` 下 `npm run dev` / `npm run build`；`backend` 下 `npm run dev` / `npm run build` / `npm start`。

---

# 0. 项目状态总览

> 本表是当前开发事实的入口。每次完成一个阶段、移动一个模块状态、或发现文档与代码不一致时，先更新这里。

## 0.1 已完成 / 进行中 / 未开始

| 模块 / 能力                | 当前状态 | 代码位置 / 说明                                                                                                                          | 下一步                                                        |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 后端基础工程               | 已完成   | `backend/src/app.ts`、`backend/src/server.ts`，已包含 Express、MongoDB 连接、健康检查、统一错误处理入口                                  | 后续路由继续挂到`/api/*`                                      |
| 用户注册 / 登录 / 当前用户 | 已完成   | `backend/src/routes/auth.routes.ts`、`backend/src/services/auth.service.ts`，已接入 bcrypt、JWT、Zod                                     | 补充接口测试和 token 过期场景验证                             |
| 前端基础工程               | 已完成   | `frontend/src/main.ts`、`frontend/src/router/index.ts`、`frontend/src/api/http.ts`，已接入 Vue Router、Pinia、Element Plus、Axios 拦截器 | 补充路由与 401 行为测试                                       |
| 前端 Prompt 页面骨架       | 已完成   | `PromptList.vue`、`PromptWorkspace.vue`、`PromptEditor.vue`、`VariableForm.vue`、`ModelSelector.vue` 已接通后端 API                      | 与 Provider 动态模型联动（Day 8）                             |
| 前端 SSE 消费工具          | 已完成   | `frontend/src/utils/sse.ts` 实现 `fetch + ReadableStream + AbortController`，并处理流中 `error` 事件                                     | 供 AI 对话、代码工具复用流式消费                              |
| Prompt 后端 CRUD           | 已完成   | `backend/src/routes/prompt.routes.ts`、`services/prompt.service.ts`，带 userId 资源隔离、分页与关键词搜索                                | 补接口测试                                                    |
| Prompt 版本管理            | 已完成   | `backend/src/models/prompt-version.model.ts`，内容变化自动生成新版本，支持恢复                                                           | 补版本对比视图（可选）                                        |
| Prompt 调用历史            | 已完成   | `backend/src/models/chat-record.model.ts` + `/api/chat-records`，记录落库、分页、详情                                                    | 补详情复用入口                                                |
| AI Adapter / DeepSeek      | 已完成   | `backend/src/services/ai/openai-client.ts` + `deepseek.adapter.ts` + `ai.service.ts`，非流式 `chat` 已实现，Key 仅后端读取               | 填`DEEPSEEK_API_KEY` 后联调真实调用                           |
| SSE 后端流式转发           | 已完成   | `backend/src/services/chat.service.ts` 的 `streamChat`，转发 chunk、落库、客户端断开 abort、流中回传错误事件                             | 与真实 Key 联调中断/完成事件                                  |
| Qwen / 第二模型            | 已完成   | `backend/src/services/ai/qwen.adapter.ts`，与 DeepSeek 共用 OpenAI 兼容客户端，`AIService` 统一按模型注册                                | 填`QWEN_API_KEY` 后验证                                       |
| Anthropic / 第三模型        | 已完成   | `backend/src/services/ai/anthropic.adapter.ts`，原生 Messages API（`x-api-key` + `system` 顶层字段 + 事件式 SSE），`AIService` 统一注册       | 填`ANTHROPIC_API_KEY` 后联调，模型 ID 可在 `ai.service.ts` 常量调整 |
| Provider 配置              | 未开始   | 文档已规划，前后端暂无代码                                                                                                               | Day 8 完成 CRUD、API Key 脱敏、连通性测试                     |
| AI 对话                    | 未开始   | 文档已规划，前后端暂无代码                                                                                                               | Day 8 完成会话、消息、多轮上下文、流式输出                    |
| 代码工具                   | 未开始   | 文档已规划，前后端暂无代码                                                                                                               | Day 9 完成场景常量、run/stream、结果落库                      |
| 统一历史记录               | 未开始   | 文档已规划，前后端暂无代码                                                                                                               | Day 10 聚合对话与代码工具记录，支持搜索和复用                 |
| 部署                       | 未开始   | 文档有 Docker / Nginx 方案，仓库暂无 Dockerfile / compose                                                                                | Day 7 后补齐并跑通                                            |
| 测试 / Lint / 格式化       | 未开始   | 当前`package.json` 只有 dev/build/start/typecheck                                                                                        | 补 Vitest / Supertest / ESLint / Prettier，再把命令加入质量门 |

## 0.2 当前开发优先级

1. ~~补齐 Prompt 后端 CRUD~~ ✅
2. ~~接入 AIService + DeepSeekAdapter，跑通非流式 `/api/chat`~~ ✅
3. ~~完成 `/api/chat/stream`，验证前端 `sse.ts` 流式链路~~ ✅
4. ~~Prompt 版本和调用历史~~ ✅（第一个闭环 MVP 已跑通）
5. 下一步：扩展 Provider、AI 对话、代码工具、统一历史记录（Day 8–10）。

## 0.3 文档维护规则

- `Claude.md` 是项目开发文档的唯一真源。
- `AGENTS.md` 只作为 AI agent 入口，指向 `Claude.md`，不要再复制一整份内容。
- 新增模块时，必须同步更新：状态表、目录结构、数据模型、API 设计、前端页面、验收标准。
- 如果代码和文档不一致，优先把不一致写到状态表，再决定改代码还是改文档。

---

# 1. 项目概述

## 1.1 项目名称

AI 开发者工作台

## 1.2 项目定位

面向开发者的 AI 开发工具，包含**四大并列功能模块**：

| 模块            | 说明                                                                      |
| --------------- | ------------------------------------------------------------------------- |
| ① Prompt 工作台 | 创建/编辑 Prompt、注入变量、调用 AI、流式输出、版本管理（原有，保持不变） |
| ② AI 对话       | 配置多个 API/模型，统一聊天入口，多轮对话                                 |
| ③ 代码工具      | 代码解释/翻译/重构/Review/生成测试等固定场景，选中代码直接套用            |
| ④ 历史记录      | 保存对话与 AI 结果，支持搜索与复用                                        |

项目重点不是堆功能，而是通过一个完整项目掌握：

`Vue 3 + Express + MongoDB + AI API + SSE + JWT + 第三方 API 封装`

---

# 2. 项目目标

最终实现一个可以实际使用的 AI 开发者工作台，四大模块并列：

**① Prompt 工作台**（原有流程，保持不变）：

```text
登录
 ↓
Prompt 管理
 ↓
选择 Prompt
 ↓
填写变量
 ↓
选择 AI 模型
 ↓
发送请求
 ↓
SSE 流式返回
 ↓
实时查看 AI 输出
 ↓
保存调用记录
 ↓
查看 Prompt 历史版本
```

**② AI 对话**：

```text
配置 API / 模型
 ↓
新建会话
 ↓
选择 Provider / 模型
 ↓
发送消息
 ↓
SSE 流式返回
 ↓
多轮对话（携带上下文）
 ↓
保存会话与消息
```

**③ 代码工具**：

```text
选择场景（解释/翻译/重构/Review/测试）
 ↓
粘贴代码
 ↓
套用场景 Prompt
 ↓
选择 Provider / 模型
 ↓
运行
 ↓
流式查看 AI 结果
 ↓
保存到历史记录
```

**④ 历史记录**：

```text
统一检索（对话 + 代码工具）
 ↓
关键词搜索
 ↓
查看输入 / 输出
 ↓
复用（继续对话 / 复制结果 / 再次运行）
```

---

# 3. 技术栈

## 前端

- Vue 3（Composition API + `<script setup>`）
- Vite
- TypeScript
- Vue Router
- Pinia
- Axios
- Markdown 渲染：markdown-it（渲染 AI 输出）

## 后端

- Node.js
- Express
- TypeScript
- Mongoose
- JWT（jsonwebtoken）
- 参数校验：Zod（与 TypeScript 集成更好，替代 Joi）
- 密码加密：bcryptjs
- dotenv

## 数据库

MongoDB

## AI

第一阶段：

- DeepSeek（OpenAI 兼容接口，SSE 格式为标准 `data:` 事件流）

第二阶段：

- 通义千问（DashScope 同样支持 OpenAI 兼容格式）

统一通过 Adapter 层接入。

## 部署

- Docker Compose
- Nginx

---

# 4. 系统架构

```text
┌─────────────────────────────────────────────┐
│                Vue 3 前端                    │
│                                             │
│ Prompt工作台 / AI对话 / 代码工具 / 历史记录 │
└──────────────────────┬──────────────────────┘
                       │ HTTP / SSE
                       ↓
┌─────────────────────────────────────────────┐
│             Express API Server               │
│                                             │
│ Routes                                       │
│   ↓                                          │
│ Middleware（鉴权/校验/错误）                 │
│   ↓                                          │
│ Controllers                                  │
│   ↓                                          │
│ Services                                     │
│   ├── UserService                            │
│   ├── PromptService        （① Prompt 工作台）│
│   ├── ChatService          （① Prompt 工作台）│
│   ├── ProviderService      （② AI 对话）     │
│   ├── ConversationService  （② AI 对话）     │
│   ├── CodeToolService      （③ 代码工具）    │
│   └── AIService            （AI 抽象层）     │
│           ↓                                  │
│       AI Adapter（DeepSeek / Qwen / 可配置）  │
└──────────────┬───────────────┬──────────────┘
               │               │
               ↓               ↓
          MongoDB          AI API
                          ├── DeepSeek
                          ├── Qwen
                          └── 用户配置的 Provider
```

---

# 5. 项目目录

## 前端

```text
frontend/
├── src/
│   ├── api/
│   │   ├── http.ts              # Axios 实例 + 拦截器
│   │   ├── auth.ts
│   │   ├── prompt.ts            # ① Prompt 工作台
│   │   ├── chat.ts              # ① Prompt 工作台
│   │   ├── provider.ts          # ② AI 对话（API/模型配置）
│   │   ├── conversation.ts      # ② AI 对话（会话/消息）
│   │   ├── code-tool.ts         # ③ 代码工具
│   │   └── history.ts           # ④ 历史记录
│   │
│   ├── components/
│   │   ├── PromptEditor.vue     # ①
│   │   ├── VariableForm.vue     # ①
│   │   ├── ModelSelector.vue    # ①
│   │   ├── ChatMessage.vue      # ① AI 输出渲染
│   │   ├── MessageBubble.vue    # ② 对话气泡
│   │   ├── ProviderForm.vue     # ② API/模型配置表单
│   │   └── CodeToolSelector.vue # ③ 场景选择
│   │
│   ├── views/
│   │   ├── Login.vue
│   │   ├── PromptList.vue       # ①
│   │   ├── PromptWorkspace.vue  # ①
│   │   ├── ChatHistory.vue      # ① 调用历史
│   │   ├── ChatView.vue         # ② AI 对话
│   │   ├── CodeToolView.vue     # ③ 代码工具
│   │   ├── HistoryView.vue      # ④ 历史记录
│   │   └── ProviderSettings.vue # ② API/模型配置页
│   │
│   ├── stores/
│   │   ├── auth.ts
│   │   ├── prompt.ts            # ①
│   │   ├── conversation.ts      # ②
│   │   └── provider.ts          # ②
│   │
│   ├── router/
│   ├── utils/
│   └── App.vue
│
├── vite.config.ts               # dev proxy → 后端
└── package.json
```

## 后端

```text
backend/
├── src/
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── prompt.routes.ts
│   │   ├── chat.routes.ts
│   │   ├── provider.routes.ts        # ② API/模型配置
│   │   ├── conversation.routes.ts    # ② AI 对话
│   │   ├── code-tool.routes.ts       # ③ 代码工具
│   │   └── history.routes.ts         # ④ 历史记录
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── prompt.controller.ts
│   │   ├── chat.controller.ts
│   │   ├── provider.controller.ts
│   │   ├── conversation.controller.ts
│   │   ├── code-tool.controller.ts
│   │   └── history.controller.ts
│   │
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── prompt.service.ts
│   │   ├── chat.service.ts
│   │   ├── provider.service.ts
│   │   ├── conversation.service.ts
│   │   ├── code-tool.service.ts
│   │   ├── history.service.ts
│   │   └── ai/
│   │       ├── ai.service.ts
│   │       ├── deepseek.adapter.ts
│   │       └── qwen.adapter.ts
│   │
│   ├── models/
│   │   ├── user.model.ts
│   │   ├── prompt.model.ts
│   │   ├── prompt-version.model.ts
│   │   ├── chat-record.model.ts      # ① Prompt 调用记录
│   │   ├── ai-provider.model.ts      # ② API/模型配置
│   │   ├── chat-session.model.ts     # ② 会话
│   │   ├── chat-message.model.ts     # ② 消息
│   │   └── code-tool-record.model.ts # ③ 代码工具记录
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── validate.middleware.ts
│   │   └── error.middleware.ts
│   │
│   ├── schemas/                 # Zod 校验
│   │   ├── auth.schema.ts
│   │   ├── prompt.schema.ts
│   │   ├── chat.schema.ts
│   │   ├── provider.schema.ts
│   │   ├── conversation.schema.ts
│   │   └── code-tool.schema.ts
│   │
│   ├── constants/
│   │   └── code-tools.ts        # ③ 代码工具场景定义
│   │
│   ├── types/
│   ├── config/
│   ├── app.ts
│   └── server.ts
│
├── Dockerfile
└── package.json
```

---

# 6. 核心数据模型

## 6.1 User

```text
User
├── _id
├── username            # 唯一索引
├── password            # bcrypt hash，绝不明文存储
├── createdAt
└── updatedAt
```

## 6.2 Prompt

```text
Prompt
├── _id
├── userId              # 索引（按用户查询）
├── name
├── description
├── content
├── variables           # 从 content 提取的变量名数组
├── currentVersion      # 当前版本号（整数）
├── createdAt
└── updatedAt
```

例如：

```text
name:
Vue Bug 分析

content:
你是一名资深前端工程师。

请分析下面的 Bug：

问题：
{{problem}}

代码：
{{code}}

要求：
1. 分析原因
2. 给出解决方案
3. 不要修改无关代码
```

变量：

```json
["problem", "code"]
```

## 6.3 PromptVersion

```text
PromptVersion
├── _id
├── promptId            # 索引（组合：promptId + version 倒序）
├── version             # 整数自增：1、2、3
├── content
├── variables
├── createdAt
└── createdBy
```

版本：

```text
v1
v2
v3
```

支持恢复历史版本（恢复 = 把该版本内容写回 Prompt，并创建新版本）。

## 6.4 ChatRecord

```text
ChatRecord
├── _id
├── userId              # 索引（组合：userId + createdAt 倒序）
├── promptId
├── promptVersion
├── model
├── input               # 变量替换后的完整 AI 输入
├── output              # 流式聚合后的最终完整文本
├── duration            # 请求耗时（ms）
├── tokenUsage          # { promptTokens, completionTokens, totalTokens }
├── status              # success / error / aborted
├── errorMessage
└── createdAt
```

用于查看：

- 使用了哪个 Prompt
- 使用了哪个模型
- 输入内容
- AI 输出
- 请求耗时
- Token 使用量
- 请求是否成功

## 6.5 AIProvider（API/模型配置，② AI 对话）

```text
AIProvider
├── _id
├── userId              # 索引（按用户查询）
├── name                # 显示名，如"我的 DeepSeek"
├── type                # 'deepseek' | 'qwen' | 'openai' | 'custom'
├── apiKey              # 后端存储，前端不回显完整 Key
├── baseUrl             # API 地址
├── models              # 模型名数组，如 ['deepseek-chat']
├── isActive            # 是否启用
├── createdAt
└── updatedAt
```

说明：

- 每个用户可配置多个 Provider，自行填入 API Key / Base URL / 模型列表
- API Key 只存在后端数据库，**绝不下发完整 Key 给前端**（回显时脱敏）

## 6.6 ChatSession（对话会话，② AI 对话）

```text
ChatSession
├── _id
├── userId              # 索引
├── title               # 会话标题（取首条用户消息前 N 字）
├── providerId          # 使用的 API 配置
├── model               # 使用的模型
├── createdAt
└── updatedAt
```

## 6.7 ChatMessage（对话消息，② AI 对话）

```text
ChatMessage
├── _id
├── sessionId           # 索引（组合：sessionId + createdAt）
├── role                # 'user' | 'assistant'
├── content
├── tokenUsage          # { promptTokens, completionTokens, totalTokens }
└── createdAt
```

## 6.8 CodeToolRecord（代码工具记录，③ 代码工具）

```text
CodeToolRecord
├── _id
├── userId              # 索引
├── toolKey             # 'explain' | 'translate' | 'refactor' | 'review' | 'test'
├── title               # 列表展示，如"重构 user.service.ts"
├── providerId
├── model
├── input               # 输入的代码
├── output              # AI 结果
├── language            # 代码语言（可选）
├── duration            # 请求耗时（ms）
├── tokenUsage          # { promptTokens, completionTokens, totalTokens }
├── status              # success / error / aborted
└── createdAt
```

## 6.9 索引设计

```text
User:            username（唯一）
Prompt:          { userId: 1, updatedAt: -1 }
PromptVersion:   { promptId: 1, version: -1 }
ChatRecord:      { userId: 1, createdAt: -1 }
AIProvider:      { userId: 1 }
ChatSession:     { userId: 1, updatedAt: -1 }
ChatMessage:     { sessionId: 1, createdAt: 1 }
CodeToolRecord:  { userId: 1, createdAt: -1 }
```

---

# 7. 核心功能

项目包含四大并列功能模块：

| 模块            | 章节    | 状态           |
| --------------- | ------- | -------------- |
| ① Prompt 工作台 | 7.2–7.8 | 原有，保持不变 |
| ② AI 对话       | 7.9     | 新增           |
| ③ 代码工具      | 7.10    | 新增           |
| ④ 历史记录      | 7.11    | 新增           |

## 7.1 用户登录

实现：

```text
注册
登录
JWT
获取当前用户
退出登录
```

接口：

```http
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### 7.1.1 完整流程图

#### 注册流程

```
User (frontend)              Login.vue                    auth.ts (API)           backend
    │                           │                            │                        │
    ├─ 输入 username/password ─→│                            │                        │
    │                           │                            │                        │
    ├─ 点击注册                 │                            │                        │
    │                           ├─ register()              │                        │
    │                           │                    ├─ http.post('/auth/register')  │
    │                           │                    │                ├─ POST /api/auth/register
    │                           │                    │                │              │
    │                           │                    │                │       ┌──────┴──────┐
    │                           │                    │                │       │ authRoutes  │
    │                           │                    │                │       └──────┬──────┘
    │                           │                    │                │              │
    │                           │                    │                │       ┌──────┴────────────┐
    │                           │                    │                │       │ registerController│
    │                           │                    │                │       └──────┬────────────┘
    │                           │                    │                │              │
    │                           │                    │                │       ┌──────┴─────────────┐
    │                           │                    │                │       │ registerService:  │
    │                           │                    │                │       │ 1. 查重 username  │
    │                           │                    │                │       │ 2. bcrypt.hash()  │
    │                           │                    │                │       │ 3. User.create()  │
    │                           │                    │                │       │ 4. 返回 user DTO │
    │                           │                    │                │       └──────┬─────────────┘
    │                           │                    │                │              │
    │                           │                    │                ├─ res { code, message, data: user }
    │                           │                    │        ← Axios 拦截器解包 ←─┤
    │                           │                    │ ← Promise.resolve(user.data)
    │                           │ ← Promise.resolve
    │       ← 显示"注册成功"     ←
    │                           │
    └─ 切换到登录模式 ──────────→
```

#### 登录流程

```
User (frontend)              Login.vue                    auth.ts (API)           backend
    │                           │                            │                        │
    ├─ 输入 username/password ─→│                            │                        │
    │                           │                            │                        │
    ├─ 点击登录                 │                            │                        │
    │                           ├─ login()                 │                        │
    │                           │                    ├─ http.post('/auth/login')   │
    │                           │                    │                ├─ POST /api/auth/login
    │                           │                    │                │              │
    │                           │                    │                │       ┌──────┴──────┐
    │                           │                    │                │       │ authRoutes  │
    │                           │                    │                │       │ validate()  │
    │                           │                    │                │       └──────┬──────┘
    │                           │                    │                │              │
    │                           │                    │                │       ┌──────┴────────────┐
    │                           │                    │                │       │ loginController   │
    │                           │                    │                │       └──────┬────────────┘
    │                           │                    │                │              │
    │                           │                    │                │       ┌──────┴──────────────┐
    │                           │                    │                │       │ loginService:      │
    │                           │                    │                │       │ 1. User.findOne() │
    │                           │                    │                │       │ 2. bcrypt.compare│
    │                           │                    │                │       │ 3. jwt.sign()     │
    │                           │                    │                │       │ 4. 返回           │
    │                           │                    │                │       │    { token, user }│
    │                           │                    │                │       └──────┬──────────────┘
    │                           │                    │                │              │
    │                           │                    │                ├─ res { code, message, data: { token, user } }
    │                           │                    │        ← Axios 拦截器解包 ←─┤
    │                           │                    │ ← Promise.resolve({ token, user })
    │                           │ ← Promise.resolve
    │                           │
    ├─ auth.setAuth(token, user)→│                    │                        │
    │                           │   保存到 localStorage                         │
    │                           │
    ├─ 显示"登录成功"           │                    │                        │
    │                           │
    └─ 跳转到 /prompts ────────→
         (或 redirect 参数)
```

#### 后续请求自动附带 Token

```
User 在任意页面              业务视图               api 模块                   backend
    │                           │                      │                          │
    ├─ 点击操作                ├─ 调用 API────→     ├─ Axios 请求拦截器─→     │
    │                           │                  │   检查 auth.token       │
    │                           │                  │   追加 headers:        │
    │                           │                  │   Authorization:       │
    │                           │                  │   Bearer <token>       │
    │                           │                  │                        │
    │                           │                  │                ├─ 后端路由  │
    │                           │                  │                │          │
    │                           │                  │                ├─ auth 中间件
    │                           │                  │                │   解析 token
    │                           │                  │                │   挂载 req.user
    │                           │                  │                │
    │                           │                  │                ├─ 业务逻辑处理
    │                           │                  │                │
    │                           │                  │  ← res { code, message, data }
    │                           │ ← Axios 响应拦截器 ←─┤
    │                           │   检查 code 是否为 0
    │                           │   如果是 401 (code=40101):
    │                           │   - logout() 清空 localStorage
    │                           │   - 跳转 /login
    │                           │   否则返回 data
    │                           │
    ├─ 继续使用结果            │
```

### 7.1.2 核心代码说明

**注册**（`backend/src/services/auth.service.ts`）：

```typescript
// 1. 查重
const exists = await User.findOne({ username });
if (exists) {
  throw new AppError(400, 40001, "用户名已存在");
}

// 2. 加密密码（10 rounds salt）
const hash = await bcrypt.hash(password, 10);

// 3. 入库
const user = await User.create({ username, password: hash });

// 4. 返回用户 DTO（不暴露密码）
return { id: user._id, username: user.username };
```

**登录**（`backend/src/services/auth.service.ts`）：

```typescript
// 1. 查用户，显式取回密码
const user = await User.findOne({ username }).select("+password");

// 2. 校验密码
if (!user || !(await bcrypt.compare(password, user.password))) {
  throw new AppError(401, 40101, "用户名或密码错误");
}

// 3. 签发 JWT
const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET, { expiresIn: "7d" });

// 4. 返回 token 和用户信息
return { token, user: toUserDto(user) };
```

**前端保存认证信息**（`frontend/src/stores/auth.ts`）：

```typescript
function setAuth(t: string, u: User) {
  token.value = t;
  user.value = u;
  localStorage.setItem("ai-workbench.token", t);
  localStorage.setItem("ai-workbench.user", JSON.stringify(u));
}
```

**前端自动注入 Token**（`frontend/src/api/http.ts`）：

```typescript
http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});
```

**后端校验 Token**（`backend/src/middleware/auth.middleware.ts`）：

```typescript
export function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json(fail(40101, "未登录"));
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json(fail(40101, "token 无效或已过期"));
  }
}
```

**前端处理 401**（`frontend/src/api/http.ts`）：

```typescript
http.interceptors.response.use(
  (res) => {
    const body = res.data as ApiResponse;
    if (body.code !== 0) {
      ElMessage.error(body.message);
      return Promise.reject(new Error(body.message));
    }
    return body.data as any;
  },
  (err) => {
    const body = err.response?.data as ApiResponse | undefined;
    if (body?.code === 40101) {
      // Token 过期或无效
      useAuthStore().logout();
      router.push({
        path: "/login",
        query: { redirect: router.currentRoute.value.fullPath },
      });
    }
    ElMessage.error(body?.message || "网络错误");
    return Promise.reject(err);
  },
);
```

### 7.1.3 关键实现细节

1. **密码安全**：
   - 注册时用 `bcrypt.hash(password, 10)` 加密，10 rounds salt（业界标准）
   - 登录时 `bcrypt.compare(inputPassword, storedHash)` 时间恒定，防止时序攻击

2. **用户名查重**：
   - User 模型上 `username` 字段加唯一索引：`unique: true`
   - 注册时先 `findOne({ username })` 查重，重复则抛 40001 错误
   - 数据库兜底：若应用层判断逻辑有漏洞，MongoDB 唯一索引会再次拦截

3. **密码不暴露**：
   - User Model 定义 `password` 字段时加 `select: false`
   - 查询默认不返回密码
   - 登录时才显式 `.select('+password')` 取回用于比对
   - 返回给前端的 `toUserDto()` 永远不包含密码

4. **JWT 无状态认证**：
   - Payload 只放身份信息：`{ userId, username }`
   - 无需在后端维护 session store，天然支持分布式
   - 过期时间 `7d`，过期后自动失效，无需后端干预

5. **Token 在浏览器存储**：
   - 前端用 localStorage 存 token（简单项目）
   - 生产环境可考虑 HttpOnly Cookie + CSRF 防护
   - 每次页面加载从 localStorage 读取恢复登录状态

6. **Authorization Header 格式**：
   - 标准格式：`Authorization: Bearer <token>`
   - 前端 Axios 拦截器自动注入
   - 后端提取时 `.replace('Bearer ', '')` 取出 token

7. **401 全局处理**：
   - Axios 响应拦截器检查 `code === 40101`
   - 清空 localStorage、logout Pinia store
   - 记录当前页面 fullPath，跳转 `/login?redirect=xxx`
   - 登录成功后重定向回原页面

关键实现：

- 密码使用 `bcrypt.hash()` 存储，登录时 `bcrypt.compare()` 校验
- JWT payload：`{ userId, username }`，过期时间 `7d`
- 前端所有请求带：

```text
Authorization: Bearer <token>
```

- `auth.middleware.ts` 解析并校验 token，成功后挂载 `req.user`

## 7.2 Prompt 管理

实现：

```text
创建 Prompt
编辑 Prompt
删除 Prompt
Prompt 列表
Prompt 详情
搜索 Prompt
```

接口：

```http
GET    /api/prompts?keyword=&page=1&pageSize=20
POST   /api/prompts
GET    /api/prompts/:id
PUT    /api/prompts/:id
DELETE /api/prompts/:id
```

说明：

- 列表支持 `keyword` 搜索（匹配 name / description）和分页
- 所有操作只允许操作**自己的** Prompt（`userId` 校验）
- 删除 Prompt 时级联删除其版本与调用记录

## 7.3 Prompt 变量

使用：

```text
{{variable}}
```

例如：

```text
请分析：

需求：
{{requirement}}

代码：
{{code}}
```

前端自动识别：

```text
requirement
code
```

生成输入表单：

```text
需求：
┌─────────────────────┐
│                     │
└─────────────────────┘

代码：
┌─────────────────────┐
│                     │
│                     │
└─────────────────────┘
```

提交时替换变量：

```text
{{requirement}}
        ↓
实际需求

{{code}}
        ↓
实际代码
```

实现要点：

```ts
// 提取变量（去重）
const VAR_REG = /\{\{\s*(\w+)\s*\}\}/g;
const keys = [...content.matchAll(VAR_REG)].map((m) => m[1]);
const variables = [...new Set(keys)];

// 渲染：把 {{var}} 替换为实际值
function renderPrompt(content: string, variables: Record<string, string>) {
  return content.replace(VAR_REG, (_, key) => variables[key] ?? "");
}
```

- **缺失变量校验**：提交前检查所有 `{{key}}` 都有值，缺一个就返回 `40001 参数校验失败`，前端给出具体提示

## 7.4 AI 调用

统一抽象：

```ts
interface ChatParams {
  model: string; // 'deepseek-chat' | 'qwen-plus'
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

interface AIAdapter {
  chat(params: ChatParams): Promise<ChatResult>;
  stream(params: ChatParams): AsyncGenerator<string>;
}
```

业务层只依赖：

```ts
AIService;
```

而不是直接依赖 DeepSeek。

结构：

```text
ChatService
    ↓
AIService
    ↓
AIAdapter
    ├── DeepSeekAdapter
    └── QwenAdapter
```

模型标识统一为常量，避免前端写死字符串：

```ts
export const AI_MODELS = {
  DEEPSEEK: "deepseek-chat",
  QWEN: "qwen-plus",
} as const;
```

这样以后增加模型只需要：

```text
新增 Adapter + 注册模型
```

而不用修改业务代码。

## 7.5 SSE 流式输出

请求：

```http
POST /api/chat/stream
```

请求数据：

```json
{
  "promptId": "xxx",
  "model": "deepseek",
  "variables": {
    "problem": "页面白屏",
    "code": "..."
  }
}
```

服务端：

```text
用户请求
 ↓
PromptService
 ↓
替换变量
 ↓
AIService
 ↓
DeepSeek API
 ↓
SSE
 ↓
前端
```

服务端设置响应头：

```text
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

前端效果：

```text
AI：
正在分析你的代码...

问题可能出现在 Vue 组件初始化阶段...

进一步分析发现...
```

而不是等 AI 完成后一次性返回。

**前端消费的关键点**（容易踩坑）：

- `EventSource` 只支持 GET，**不能**携带请求体，所以 `POST /api/chat/stream` 必须用 `fetch` + `ReadableStream` 消费
- 用 `AbortController` 支持"停止生成"

## 7.6 多模型

第一阶段：

```text
DeepSeek
```

第二阶段：

```text
DeepSeek
通义千问
```

前端：

```text
模型：

○ DeepSeek
○ Qwen
```

统一调用：

```ts
AIService.chat({
  model,
  messages,
});
```

模型差异隐藏在 Adapter 中。

## 7.7 Prompt 版本管理

每次修改 Prompt：

```text
v1
 ↓
v2
 ↓
v3
```

例如：

```text
当前版本：v3

历史版本：

v3  2026-08-03
v2  2026-08-02
v1  2026-08-01
```

版本策略：

- `version` 为整数自增（`currentVersion + 1`）
- **保存 Prompt 且 content 发生变化时，自动生成新版本**，并同步 `currentVersion`
- 内容未变则不生成新版本，避免产生空版本

支持：

```text
查看
对比
恢复
```

## 7.8 调用历史

调用历史页面：

```text
时间          Prompt       模型       耗时
------------------------------------------------
08-03 10:20   Bug分析      DeepSeek   3.2s
08-03 10:10   Bug分析      Qwen       2.8s
08-02 16:30   代码Review   DeepSeek   4.1s
```

点击查看：

```text
Prompt
 ↓
变量
 ↓
AI输入
 ↓
AI输出
```

- 列表接口支持分页（`?page=1&pageSize=20`）
- `output` 存流式聚合后的完整文本，而非分段 chunk，便于回看

## 7.9 AI 对话

**定位**：统一聊天入口，支持配置多个 API/模型，多轮对话（携带上下文）。

实现：

```text
Provider 管理（配置多个 API/模型）
对话会话（新建 / 列表 / 删除）
多轮消息（携带历史上下文）
流式输出（复用 7.5 SSE）
```

关键实现：

- **多 Provider 配置**：用户在 Provider 配置页维护多个 API（DeepSeek / Qwen / OpenAI / 自定义），每个含 API Key、Base URL、模型列表
- **模型来自配置**：模型下拉不再写死，而是从启用的 Provider 里动态读取；模型用 `providerId + model` 唯一定位
- **多轮上下文**：发消息时把该会话历史 `messages`（user / assistant）一起传给 AI，实现连续对话
- **会话标题**：新建会话后，用首条用户消息前 20 字自动生成标题

接口：

```http
GET    /api/providers
POST   /api/providers
PUT    /api/providers/:id
DELETE /api/providers/:id
POST   /api/providers/:id/test        # 连通性测试（可选）

GET    /api/conversations
POST   /api/conversations
GET    /api/conversations/:id         # 会话 + 消息列表
DELETE /api/conversations/:id
POST   /api/conversations/:id/messages        # 发消息（非流式）
POST   /api/conversations/:id/stream          # 发消息（SSE 流式）
```

说明：

- 与 7.4 的 `/api/chat`（Prompt 工作台单次运行）**互不干扰**：对话走 `/api/conversations`，Prompt 运行走 `/api/chat`
- API Key 只存后端，`GET /api/providers` 返回时对 Key 脱敏

## 7.10 代码工具

**定位**：固定场景的代码处理工具，粘贴代码后一键套用对应场景 Prompt。

固定场景（定义于 `constants/code-tools.ts`）：

| key       | 名称        | 说明                 |
| --------- | ----------- | -------------------- |
| explain   | 代码解释    | 逐段解释代码逻辑     |
| translate | 代码翻译    | 在语言之间互译       |
| refactor  | 代码重构    | 优化结构、可读性     |
| review    | Code Review | 审查代码问题并给建议 |
| test      | 生成测试    | 为代码生成单元测试   |

实现：

```text
选择场景（工具）
 ↓
粘贴代码（整段套用，不做片段选中）
 ↓
后端按场景套用 system prompt 模板
 ↓
调用 AI（复用 AIService）
 ↓
流式返回（复用 7.5 SSE）
 ↓
保存到 CodeToolRecord（供 7.11 历史记录检索）
```

接口：

```http
GET  /api/code-tools                    # 返回可用场景列表
POST /api/code-tools/:key/run           # 非流式执行
POST /api/code-tools/:key/stream        # SSE 流式执行
```

关键实现：

- 场景定义为一个常量数组，每项含 `key / name / systemPrompt / inputHint`
- 调用时用 `systemPrompt + 代码` 拼装 messages，走统一的 `AIService`
- 结果落库 `CodeToolRecord`，供历史记录检索复用

## 7.11 历史记录

**定位**：保存「AI 对话」与「代码工具」的 AI 结果，统一搜索与复用。（独立模块，不含 7.8 的 Prompt 调用历史）

数据来源：

```text
历史记录
├── 对话会话（ChatSession + ChatMessage）
└── 代码工具结果（CodeToolRecord）
```

实现：

```text
统一列表（可筛选来源：对话 / 代码工具）
 ↓
关键词搜索（匹配标题 / 输入 / 输出）
 ↓
查看输入 / 输出
 ↓
复用（继续对话 / 复制结果 / 再次运行）
```

接口：

```http
GET /api/history?keyword=&type=chat|code-tool&page=1&pageSize=20
```

说明：

- `type=chat` 返回会话列表（含最后一条消息摘要），`type=code-tool` 返回工具记录，缺省返回全部
- 复用方式：对话可直接进入继续聊；代码工具结果可一键复制或「再次运行」
- 与 7.8 调用历史（Prompt 运行记录）**并列独立**，互不包含

---

# 8. API 设计

约定：`🔒` 表示需要 `Authorization: Bearer <token>`

## 8.0 API 契约书写规则

新增或修改接口时，必须在本章补齐以下信息，不能只写路径：

```text
方法 + 路径
是否鉴权
请求 query / params / body
成功响应 data 结构
可能错误码
是否产生副作用（写库 / 调 AI / 删除级联）
资源归属规则（是否只能访问自己的数据）
```

示例：

```http
POST /api/prompts 🔒
```

请求：

```json
{
  "name": "Vue Bug 分析",
  "description": "分析 Vue 报错与白屏问题",
  "content": "请分析：{{code}}"
}
```

响应：

```json
{
  "id": "xxx",
  "name": "Vue Bug 分析",
  "description": "分析 Vue 报错与白屏问题",
  "content": "请分析：{{code}}",
  "variables": ["code"],
  "currentVersion": 1,
  "createdAt": "2026-08-17T00:00:00.000Z",
  "updatedAt": "2026-08-17T00:00:00.000Z"
}
```

错误：

- `40001`：参数校验失败
- `40101`：未登录 / token 无效
- `40301`：无权操作他人资源
- `40401`：资源不存在

资源归属：

- 所有带 `userId` 的模型，查询条件必须带当前登录用户。
- 更新 / 删除 / 恢复前必须先确认资源归属。
- 前端传来的 `userId` 一律不可信，后端只能使用 `req.user.userId`。

SSE 接口补充约定：

- SSE 不走统一 `{ code, message, data }` 响应体。
- 普通增量事件使用 `data: <OpenAI-compatible JSON>`。
- 正常结束发送 `data: [DONE]`。
- 服务端异常应尽量发送错误事件后结束连接，同时落服务端日志。
- 前端停止生成时，后端应识别连接关闭，停止继续写入响应。

## Auth

```http
POST /api/auth/register        # 注册（公开）
POST /api/auth/login           # 登录（公开）
GET  /api/auth/me              # 当前用户（🔒）
```

登录响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": { "token": "xxx", "user": { "id": "..", "username": ".." } }
}
```

## Prompt（全部 🔒）

```http
GET    /api/prompts?keyword=&page=1&pageSize=20
POST   /api/prompts
GET    /api/prompts/:id
PUT    /api/prompts/:id
DELETE /api/prompts/:id
```

## Version（全部 🔒）

```http
GET  /api/prompts/:id/versions
POST /api/prompts/:id/versions                # 手动保存当前为新版本
POST /api/prompts/:id/versions/:version/restore   # 恢复历史版本
```

## Chat（全部 🔒）

```http
POST /api/chat          # 非流式，一次性返回
POST /api/chat/stream   # SSE 流式返回
```

## 调用历史 CallRecords（① Prompt，全部 🔒）

```http
GET /api/chat-records?page=1&pageSize=20
GET /api/chat-records/:id
```

## Provider（② AI 对话，全部 🔒）

```http
GET    /api/providers                     # 列表（apiKey 脱敏）
POST   /api/providers                     # 新增配置
PUT    /api/providers/:id                 # 编辑
DELETE /api/providers/:id                 # 删除
POST   /api/providers/:id/test            # 连通性测试（可选）
```

## Conversation（② AI 对话，全部 🔒）

```http
GET    /api/conversations                 # 会话列表
POST   /api/conversations                 # 新建会话
GET    /api/conversations/:id             # 会话详情（含消息）
DELETE /api/conversations/:id             # 删除会话
POST   /api/conversations/:id/messages    # 发消息（非流式）
POST   /api/conversations/:id/stream      # 发消息（SSE 流式）
```

## CodeTool（③ 代码工具，全部 🔒）

```http
GET  /api/code-tools                      # 场景列表
POST /api/code-tools/:key/run             # 非流式执行
POST /api/code-tools/:key/stream          # SSE 流式执行
```

## 历史记录 History（④，全部 🔒）

```http
GET /api/history?keyword=&type=chat|code-tool&page=1&pageSize=20
```

---

# 9. 统一响应格式

所有接口统一返回（SSE 流式接口除外）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {}
}
```

错误时：

```json
{
  "code": 40001,
  "message": "参数错误：缺少变量 code",
  "data": null
}
```

错误码约定：

| code  | 含义                      |
| ----- | ------------------------- |
| 0     | 成功                      |
| 40001 | 参数校验失败              |
| 40101 | 未登录 / token 无效或过期 |
| 40301 | 无权操作该资源            |
| 40401 | 资源不存在                |
| 50000 | 服务器内部错误            |

后端封装：

```ts
export const ok = (data: unknown) => ({ code: 0, message: "ok", data });
export const fail = (code: number, message: string) => ({ code, message, data: null });
```

---

# 10. 前端工程化

## 10.0 前端编写约定

- 路由页只负责组合和调度，不把整套业务逻辑堆在页面里。
- `script setup + TypeScript` 是默认写法，组件名和文件名都用 PascalCase。
- `props` 只读，子组件需要修改父状态时必须 `emit` 或用 `v-model`。
- 只有真正需要双向绑定的场景才用 `v-model`，例如 `PromptEditor`、`ModelSelector`。
- 需要共享状态时优先用 Pinia，不要跨层级乱传事件。
- `v-html` 只能用于已明确净化/受控的 Markdown 渲染，不能直接渲染用户原文。
- 复杂派生值放进 `computed`，不要塞进模板里现算。

## 10.1 Vite dev proxy

开发时前端 `5173` → 后端 `3000`，避免跨域：

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
```

生产环境由 Nginx 反代，无需 CORS。

## 10.2 Axios 封装

`src/api/http.ts`：统一注入 token、解包 `data`、处理 401。

```ts
const http = axios.create({ baseURL: "/api" });

http.interceptors.request.use((config) => {
  const token = useAuthStore().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res.data.data, // 直接解包业务数据
  (err) => {
    if (err.response?.data?.code === 40101) {
      useAuthStore().logout();
      router.push("/login");
    }
    return Promise.reject(err.response?.data ?? err);
  },
);
```

## 10.3 路由守卫

```ts
router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth && !auth.token) return { path: "/login" };
});
```

## 10.4 SSE 前端消费

**为什么不用 EventSource**：`EventSource` 只支持 GET，无法发送请求体和 `Authorization` 头，因此必须用 `fetch` + `ReadableStream`。

```ts
async function streamChat(payload, onChunk) {
  const controller = new AbortController();

  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
    signal: controller.signal,
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE 事件以空行 \n\n 分隔
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";

    for (const event of events) {
      const dataLines = event
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim());

      for (const data of dataLines) {
        if (data === "[DONE]") return; // 流结束标记
        const json = JSON.parse(data);
        onChunk(json.choices?.[0]?.delta?.content ?? "");
      }
    }
  }
}

// 停止生成
controller.abort();
```

前端实现时还要注意：

- 解析 SSE 时要容忍分片边界，不要假设每个 chunk 都是完整事件。
- 收到 `AbortError` 时要把 UI 状态恢复为“已停止”，不要当成失败弹红条。
- 流式输出结束后，如果后端没有明确回传结果摘要，前端要保留已聚合的正文。
- 发送流式请求前先校验必填变量，避免把明显无效请求打到后端。

---

# 11. 后端工程化

## 11.1 参数校验（Zod）

```ts
const loginSchema = z.object({
  username: z.string().min(3).max(20),
  password: z.string().min(6).max(50),
});
```

通过 `validate.middleware` 统一校验，失败返回 `40001`：

```ts
export const validate = (schema: ZodSchema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json(fail(40001, "参数校验失败"));
  }
  req.body = result.data;
  next();
};
```

## 11.2 鉴权中间件

```ts
export function auth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json(fail(40101, "未登录"));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json(fail(40101, "token 无效或已过期"));
  }
}
```

## 11.3 统一错误处理

`error.middleware.ts`：兜底捕获异常，返回 `50000`，不把堆栈暴露给前端：

```ts
export function errorHandler(err, req, res, next) {
  console.error(err); // 服务端日志
  res.status(500).json(fail(50000, "服务器内部错误"));
}
```

## 11.4 日志

- 开发：`morgan('dev')`
- SSE 流式过程中产生的错误记录到服务端日志，并在流中回传错误事件

## 11.5 质量门

每次完成一个阶段，至少检查以下内容：

- `backend`：`npm run build`
- `frontend`：`npm run typecheck` 或 `npm run build`
- 认证接口：注册、登录、`/api/auth/me`、退出登录流程
- Prompt 路径：列表、创建、编辑、删除、恢复版本
- SSE 路径：开始、流式中断、异常、结束标记
- 历史路径：分页、详情、空状态

如果当前机器出现原生依赖平台不匹配，先重装对应子项目依赖，再继续验收。当前仓库里 `node_modules` 里曾出现 `darwin-arm64` 包与 `darwin-x64` 运行环境不一致的情况，后续拉环境时要优先注意。

---

# 12. 部署

## 12.1 docker-compose.yml

```yaml
services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db

  backend:
    build: ./backend
    restart: unless-stopped
    env_file: ./backend/.env
    depends_on:
      - mongo

  frontend:
    build: ./frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  mongo-data:
```

## 12.2 Nginx

**SSE 必须关闭代理缓冲**，否则 Nginx 会把流式内容攒到结束才一次性返回，前端无法实时显示：

```nginx
location /api/ {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /api/chat/stream {
    proxy_pass http://backend:3000;
    proxy_http_version 1.1;
    proxy_set_header Connection '';
    proxy_buffering off;          # 关键：关闭缓冲
    proxy_cache off;
    proxy_read_timeout 300s;      # 流式连接超时放宽
}
```

---

# 13. 安全清单

开发收尾时逐项确认：

```text
☐ 密码使用 bcrypt 加密存储，禁止明文
☐ JWT_SECRET 使用强随机值，token 设过期时间
☐ AI API Key 只存在后端 .env，绝不放前端（含打包产物）
☐ .env 文件加入 .gitignore，不上传到仓库
☐ 所有业务接口挂 auth 中间件
☐ 越权校验：只能操作自己的资源（userId 比对）
☐ helmet 设置安全响应头
☐ CORS 仅允许前端域名（开发用 Vite 代理，无需放开）
☐ express-rate-limit 限制登录/注册接口防暴力破解
☐ 参数全部 Zod 校验
☐ 统一错误处理，不向前端暴露堆栈
```

---

# 14. 前端页面

共 8 个页面，对应四大模块：

| 模块            | 页面                                       |
| --------------- | ------------------------------------------ |
| 公共            | 登录页                                     |
| ① Prompt 工作台 | Prompt 管理页 / Prompt 工作台 / 调用历史页 |
| ② AI 对话       | AI 对话页 / Provider 配置页                |
| ③ 代码工具      | 代码工具页                                 |
| ④ 历史记录      | 历史记录页                                 |

## 登录页

```text
用户名
密码

[登录]
```

## Prompt 管理页（①）

```text
我的 Prompt

[新建 Prompt]

--------------------------------
Vue Bug 分析
代码 Review
需求分析
接口设计
--------------------------------
```

## Prompt 工作台（①）

```text
┌───────────────┬─────────────────────────┐
│ Prompt        │ AI 输出                 │
│               │                         │
│ 系统提示词    │                         │
│               │                         │
│ {{code}}      │ AI 正在分析...          │
│ {{problem}}   │                         │
│               │                         │
│               │                         │
│ 模型：        │                         │
│ DeepSeek      │                         │
│               │                         │
│ [运行]        │                         │
└───────────────┴─────────────────────────┘
```

## 调用历史页（①）

```text
调用时间
Prompt
模型
耗时
状态

点击 → 查看完整输入输出
```

## Provider 配置页（②）

```text
我的 API / 模型

[新增 Provider]

--------------------------------
我的 DeepSeek   ● 启用
我的 Qwen       ○ 停用
--------------------------------

表单：名称 / 类型 / API Key / Base URL / 模型列表
```

## AI 对话页（②）

```text
┌──────────────────────────────────────┐
│ 会话列表         │  对话区            │
│                  │                    │
│ 会话 1           │  [用户] 这段代码   │
│ 会话 2           │  [AI] 分析如下...  │
│                  │                    │
│ [新建会话]       │  ┌────────────┐    │
│                  │  │ 输入消息…   │    │
│                  │  └────────────┘    │
│                  │  模型: [DeepSeek▾] │
└──────────────────────────────────────┘
```

## 代码工具页（③）

```text
场景：[代码解释▾] [代码重构▾] [Code Review▾] …

┌──────────────────────────────────────┐
│ 粘贴代码                             │
│                                      │
│ function foo() { ... }               │
│                                      │
└──────────────────────────────────────┘

模型：[DeepSeek▾]   [运行]

──────────────────────────────────────
AI 结果（流式输出）
```

## 历史记录页（④）

```text
[搜索关键词________]  来源：[全部▾]

--------------------------------
08-03  对话 · 关于 xxx 的讨论
08-03  代码工具 · 重构 user.service.ts
08-02  对话 · 解释闭包
--------------------------------

点击 → 查看输入 / 输出 → 复用
```

---

# 15. 环境变量

## 15.1 本地运行前提

- Node.js 版本建议固定在当前项目能稳定运行的 LTS 版本。
- 前后端分别在 `frontend/` 和 `backend/` 内独立安装依赖、独立构建。
- 先确认当前机器架构，再安装依赖：

```bash
node -p "process.platform + ' ' + process.arch"
```

- 如果本机出现原生依赖缺失或架构不匹配，优先删除对应子项目的 `node_modules` 后重新安装。
- `node_modules/`、`dist/`、`*.tsbuildinfo`、`.env` 不应提交进仓库。

## 15.2 安装与启动

```bash
cd frontend && npm install && npm run dev
cd backend && npm install && npm run dev
```

开发时默认约定：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`
- 前端请求统一走 `/api`，由 Vite proxy 转发

## 15.3 后端 `.env.example`

后端 `.env.example`：

```env
PORT=3000

MONGODB_URI=mongodb://localhost:27017/ai-workbench

JWT_SECRET=xxx
JWT_EXPIRES_IN=7d

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com

QWEN_API_KEY=
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

可选前端环境：

```env
VITE_API_BASE_URL=/api
```

注意：

**AI API Key 永远不能放到前端。**

正确：

```text
Vue
 ↓
Express
 ↓
AI API
```

错误：

```text
Vue
 ↓
AI API
```

**Provider 配置说明**：

- `.env` 里的 `DEEPSEEK_*` / `QWEN_*` 作为**内置默认 Provider**，开机即用（对应 Prompt 工作台与各模块的默认模型）
- 用户在 ② AI 对话中**自定义的 Provider**，其 API Key 存 MongoDB 的 `AIProvider` 集合，而非 `.env`
- 自定义 Provider 的 API Key 同样只存后端，接口返回时脱敏

---

# 16. 开发阶段

## Day 1：项目基础

目标：

```text
Vue
Express
MongoDB
```

完成：

- 创建项目
- 前后端启动
- MongoDB 连接
- Express 分层
- `/api/health`
- 注册 / 登录接口（bcrypt + JWT 先行，保证后续接口都带鉴权）

## Day 2：Prompt CRUD

完成：

- Prompt Model
- Prompt API（已挂鉴权）
- Prompt 列表 / 创建 / 编辑 / 删除
- 前端 Prompt 列表页

## Day 3：AI 接入

完成：

```text
AIService
DeepSeekAdapter
```

实现：

```http
POST /api/chat
```

完成：

```text
Prompt
+
变量
+
用户输入
↓
DeepSeek
↓
AI结果
```

## Day 4：SSE

完成：

```http
POST /api/chat/stream
```

实现：

```text
AI生成
 ↓
后端实时转发
 ↓
前端实时显示
```

这是整个项目的重点技术之一。

## Day 5：第二个模型

增加：

```text
QwenAdapter
```

前端：

```text
DeepSeek
Qwen
```

实现模型切换。

## Day 6：版本 + 历史

完成：

```text
PromptVersion
ChatRecord
```

实现：

- Prompt 版本
- 版本恢复
- 调用记录
- 查看历史输入输出

## Day 7：完善

完成：

- 鉴权完善（token 过期处理、401 全局拦截、退出登录）
- 参数校验
- 统一错误处理
- Loading
- 空状态
- SSE 异常处理（中断、停止生成）
- API Key 环境变量
- Docker 部署
- 安全清单逐项确认

## Day 8：AI 对话（②）

完成：

```text
AIProvider 模型
Provider 管理 API（CRUD + 脱敏）
Conversation 模型（会话 / 消息）
多轮对话（携带历史上下文）
SSE 流式对话（复用 7.5 思路）
```

实现：

- Provider 配置页（前端）
- AI 对话页（会话列表 + 消息流 + 模型切换）

## Day 9：代码工具（③）

完成：

```text
代码工具场景常量（explain / translate / refactor / review / test）
CodeToolRecord 模型
代码工具 API（run / stream）
```

实现：

- 代码工具页（选场景 → 粘贴代码 → 流式结果）
- 结果落库，供历史记录检索

## Day 10：历史记录（④）

完成：

```text
统一历史检索 API（/api/history）
聚合对话会话 + 代码工具记录
关键词搜索 + 来源筛选
复用（继续对话 / 复制 / 再次运行）
```

实现：

- 历史记录页（搜索 + 列表 + 复用入口）
- 与 7.8 调用历史并列，互不干扰

---

# 17. MVP 验收标准

完成以下流程就算项目成功：

```text
注册
 ↓
登录
 ↓
创建 Prompt
 ↓
定义 {{code}} 变量
 ↓
选择 Prompt
 ↓
输入代码
 ↓
选择 DeepSeek
 ↓
点击运行
 ↓
AI 流式输出
 ↓
保存调用记录
 ↓
修改 Prompt
 ↓
生成 v2
 ↓
切换 Qwen
 ↓
再次运行
 ↓
查看历史记录
 ↓
恢复 v1
```

三大新增模块的验收流程：

**② AI 对话**：

```text
配置一个自定义 Provider（含 API Key / 模型）
 ↓
新建会话
 ↓
发送消息
 ↓
SSE 流式返回
 ↓
继续追问（验证多轮上下文）
 ↓
切换 Provider / 模型
 ↓
会话保存，可再次进入继续聊
```

**③ 代码工具**：

```text
进入代码工具页
 ↓
选择场景（如"代码解释"）
 ↓
粘贴代码
 ↓
选择模型
 ↓
运行
 ↓
流式查看 AI 结果
 ↓
结果保存到历史记录
```

**④ 历史记录**：

```text
进入历史记录页
 ↓
关键词搜索
 ↓
按来源筛选（对话 / 代码工具）
 ↓
查看输入 / 输出
 ↓
复用（继续对话 / 复制结果 / 再次运行）
```

---

# 18. 第一阶段明确不做

为了控制项目成本，暂时不做：

```text
❌ Agent
❌ MCP
❌ Skill
❌ RAG
❌ 向量数据库
❌ 知识库
❌ 团队协作
❌ RBAC
❌ 自动 Prompt 评分
❌ AI 自动优化 Prompt
❌ 多人实时编辑
```

这些属于后续升级方向。

---

# 19. 后续升级路线

第一阶段（当前，四大模块并列）：

```text
AI 开发者工作台

Prompt 工作台
+
AI 对话
+
代码工具
+
历史记录
```

↓

第二阶段：

```text
Prompt 评测平台

测试集
+
模型对比
+
自动评分
+
Token统计
```

↓

第三阶段：

```text
Agent 工作台

Prompt
+
Skill
+
Tool
+
MCP
+
Agent
```

↓

最终：

```text
AI 开发者工作台
```

---

# 20. 项目最终技术能力

完成这个项目后，能够覆盖：

```text
Vue 3
    ↓
HTTP / REST API
    ↓
Express
    ↓
Controller
    ↓
Service
    ↓
MongoDB
    ↓
第三方 AI API
    ↓
SSE
    ↓
流式数据
```

同时掌握：

- Node.js 后端项目结构
- Express 路由与中间件
- MongoDB/Mongoose
- JWT 鉴权
- REST API 设计
- 第三方 API 封装
- Adapter 设计模式
- SSE 流式通信
- Prompt 变量处理
- 版本管理
- AI 调用日志
- 多轮对话上下文管理
- Provider 动态配置（多 API/模型）
- 场景化 Prompt 模板（代码工具）
- 统一历史检索与复用
- Docker 部署

**项目原则：先把"Prompt → AI → 流式输出 → 数据持久化"这条主链路跑通，再逐项加入对话、代码工具、历史记录三大并列模块，不为了堆功能而堆功能。**
