/** Isolated manual/E2E test backend. No real AI provider or personal database is used. */
import http from "node:http";
import mongoose from "../backend/node_modules/mongoose/index.js";

const port = Number(process.env.QA_PORT || 3000);
const database = `ai-workbench-refactor-qa-${Date.now()}`;
const ai = http.createServer(async (req, res) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const request = JSON.parse(raw || "{}");
  const system =
    request.messages?.find((message) => message.role === "system")?.content ||
    "";
  const language = system.match(/目标编程语言：([^\n]+)/)?.[1] || "自动识别";
  const content = `## 测试生成结果\n\n目标语言：${language}\n\n这是本地测试服务返回的内容，不是真实模型输出。\n\n\`\`\`js\nconst answer = 42;\n\`\`\`\n\n- 保持原有行为\n- 覆盖边界情况\n- 在使用前验证结果`;
  const usage = { prompt_tokens: 12, completion_tokens: 30, total_tokens: 42 };
  if (!request.stream) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content } }], usage }));
    return;
  }
  res.writeHead(200, { "content-type": "text/event-stream" });
  let offset = 0;
  const timer = setInterval(() => {
    if (offset < content.length) {
      res.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: content.slice(offset, offset + 6) } }] })}\n\n`,
      );
      offset += 6;
    } else {
      res.write(
        `data: ${JSON.stringify({ choices: [], usage })}\n\ndata: [DONE]\n\n`,
      );
      clearInterval(timer);
      res.end();
    }
  }, 100);
  res.on("close", () => clearInterval(timer));
});
await new Promise((resolve) => ai.listen(0, "127.0.0.1", resolve));
const baseUrl = `http://127.0.0.1:${ai.address().port}`;
Object.assign(process.env, {
  MONGODB_URI: `mongodb://127.0.0.1:27017/${database}`,
  JWT_SECRET: "isolated-local-qa-only-not-for-production",
  DEEPSEEK_API_KEY: "qa-local-key",
  DEEPSEEK_BASE_URL: baseUrl,
  QWEN_API_KEY: "qa-local-key",
  QWEN_BASE_URL: baseUrl,
  ANTHROPIC_API_KEY: "",
  ANTHROPIC_BASE_URL: baseUrl,
});
const { default: app } = await import("../backend/dist/app.js");
await mongoose.connect(process.env.MONGODB_URI);
const server = await new Promise((resolve) => {
  const instance = app.listen(port, "127.0.0.1", () => resolve(instance));
});
async function api(path, body, token) {
  const response = await fetch(`http://127.0.0.1:${port}/api${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (result.code !== 0) throw new Error(result.message);
  return result.data;
}
await api("/auth/register", {
  username: "qa_developer",
  password: "qa-test-2026",
});
const { token } = await api("/auth/login", {
  username: "qa_developer",
  password: "qa-test-2026",
});
for (const [name, description, content] of [
  [
    "代码审查助手",
    "从正确性、可读性与边界情况三个维度审查代码",
    "请审查以下 {{language}} 代码：\n{{code}}",
  ],
  [
    "技术方案设计",
    "从需求到方案，梳理实现路径与技术取舍",
    "请为以下需求制定技术实现方案：\n{{requirement}}",
  ],
  [
    "单元测试生成",
    "覆盖正常流程、边界与异常场景",
    "为下面的函数生成单元测试：\n{{code}}",
  ],
])
  await api("/prompts", { name, description, content }, token);
console.log(`QA backend: http://127.0.0.1:${port}`);
console.log("QA login: qa_developer / qa-test-2026");
console.log(`Isolated DB: ${database}; removed on clean shutdown.`);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  server.closeAllConnections();
  server.close();
  ai.closeAllConnections();
  ai.close();
  // Only remove the database name created by this process, never an environment-supplied DB.
  if (mongoose.connection.name === database)
    await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
process.once("SIGINT", () => {
  void close();
});
process.once("SIGTERM", () => {
  void close();
});
