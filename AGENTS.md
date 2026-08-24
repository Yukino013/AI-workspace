# AI 工作台开发文档

> 面向开发者的 AI 开发工具（Prompt 工作台 + AI 对话 + 代码工具 + 历史记录）
> 核心目标：通过一个完整项目掌握 `Vue 3 + Express + MongoDB + AI API + SSE + JWT + 第三方 API 封装`

---

## 开发状态与约定

**当前状态**：后端已完成 Day 1（项目基础 + 注册/登录），前端骨架已搭好。本文档既是开发设计文档，也是本项目的 AGENTS.md，后续开发一律以本文档为准。

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
