import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// Exercise the actual TypeScript modules using the esbuild bundled with Vite.
async function loadModule(file, mocks = {}) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(file, import.meta.url))],
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    define: {
      "import.meta.env.VITE_API_BASE_URL": '"https://api.example.test/custom"',
    },
    plugins: [
      {
        name: "test-boundaries",
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, (args) =>
            args.path in mocks
              ? { path: args.path, namespace: "mock" }
              : undefined,
          );
          builder.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
            contents: mocks[args.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  );
}
const auth = {
  token: "test-token",
  logout() {
    this.token = "";
  },
};
const redirects = [];
globalThis.__sseAuth = auth;
globalThis.__sseRouter = {
  currentRoute: { value: { fullPath: "/chat" } },
  replace(value) {
    redirects.push(value);
  },
};
const { streamEndpoint } = await loadModule("../src/utils/sse.ts", {
  "@/stores/auth": "export const useAuthStore = () => globalThis.__sseAuth;",
  "@/router": "export default globalThis.__sseRouter;",
});
const { historyMarkdown, safeFileName } = await loadModule(
  "../src/utils/history-export.ts",
);
const { codeToolMarkdown } = await loadModule("../src/utils/code-tool-export.ts");
const originalFetch = globalThis.fetch;
const delta = (text) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\r\n\r\n`;
function response(
  text,
  chunkSize = 3,
  headers = { "content-type": "text/event-stream" },
) {
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += chunkSize)
          controller.enqueue(bytes.slice(i, i + chunkSize));
        controller.close();
      },
    }),
    { headers },
  );
}
function consume() {
  return new Promise((resolve) => {
    const chunks = [];
    streamEndpoint(
      "/api/test/stream",
      { code: "test" },
      {
        onChunk: (text) => chunks.push(text),
        onDone: () => resolve({ output: chunks.join(""), done: true }),
        onError: (error) => resolve({ output: chunks.join(""), error }),
      },
    );
  });
}
function consumeWithReasoning() {
  return new Promise((resolve) => {
    const chunks = [];
    const reasoning = [];
    streamEndpoint(
      "/api/test/stream",
      { code: "test" },
      {
        onChunk: (text) => chunks.push(text),
        onReasoning: (text) => reasoning.push(text),
        onDone: () => resolve({ output: chunks.join(""), reasoning: reasoning.join(""), done: true }),
        onError: (error) => resolve({ output: chunks.join(""), reasoning: reasoning.join(""), error }),
      },
    );
  });
}
await test("SSE: fragmented UTF-8, CRLF and heartbeats preserve Chinese output", async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.example.test/custom/test/stream");
    assert.equal(init.headers.Authorization, "Bearer test-token");
    return response(
      ": heartbeat\r\n\r\n" +
        delta("你好，") +
        delta("世界") +
        "data: [DONE]\r\n\r\n",
      1,
    );
  };
  assert.deepEqual(await consume(), { output: "你好，世界", done: true });
});
await test("SSE: DONE without a trailing delimiter still completes", async () => {
  globalThis.fetch = async () => response(delta("ok") + "data: [DONE]");
  assert.deepEqual(await consume(), { output: "ok", done: true });
});
await test("SSE: public reasoning is delivered separately from final output", async () => {
  globalThis.fetch = async () =>
    response(
      "data: " +
        JSON.stringify({ choices: [{ delta: { reasoning_content: "先分析接口。" } }] }) +
        "\n\n" +
        delta("const answer = 42;") +
        "data: [DONE]\n\n",
    );
  assert.deepEqual(await consumeWithReasoning(), {
    output: "const answer = 42;",
    reasoning: "先分析接口。",
    done: true,
  });
});
await test("SSE: reasoning and content in one chunk are both preserved", async () => {
  globalThis.fetch = async () =>
    response(
      "data: " +
        JSON.stringify({
          choices: [{ delta: { reasoning: "检查边界条件。", content: "return value;" } }],
        }) +
        "\n\ndata: [DONE]\n\n",
    );
  assert.deepEqual(await consumeWithReasoning(), {
    output: "return value;",
    reasoning: "检查边界条件。",
    done: true,
  });
});
await test("SSE: old content-only events remain compatible without reasoning handler", async () => {
  globalThis.fetch = async () => response(delta("legacy output") + "data: [DONE]\n\n");
  assert.deepEqual(await consume(), { output: "legacy output", done: true });
});
await test("SSE: truncated stream reports failure instead of false success", async () => {
  globalThis.fetch = async () => response(delta("partial"));
  const result = await consume();
  assert.equal(result.output, "partial");
  assert.match(result.error.message, /连接意外中断/);
});
await test("SSE: a server error event is propagated with its message", async () => {
  globalThis.fetch = async () =>
    response('data: {"error":{"message":"上游服务不可用"}}\n\n');
  assert.equal((await consume()).error.message, "上游服务不可用");
});
await test("SSE: invalid JSON is rejected", async () => {
  globalThis.fetch = async () => response("data: invalid-json\n\n");
  assert.match((await consume()).error.message, /无法解析/);
});
await test("SSE: HTML fallback is not treated as generated content", async () => {
  globalThis.fetch = async () =>
    response("<html>proxy error</html>", 100, { "content-type": "text/html" });
  assert.match((await consume()).error.message, /未返回 SSE/);
});
await test("SSE: abort closes the lifecycle exactly once", async () => {
  globalThis.fetch = async (_url, init) =>
    new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError")),
      );
    });
  let done = 0;
  let errors = 0;
  const controller = streamEndpoint(
    "/api/test/stream",
    {},
    {
      onChunk() {},
      onDone() {
        done++;
      },
      onError() {
        errors++;
      },
    },
  );
  controller.abort();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(done, 1);
  assert.equal(errors, 0);
});
await test("SSE: HTTP 401 clears login state and preserves return path", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "登录已过期" }), { status: 401 });
  assert.equal((await consume()).error.message, "登录已过期");
  assert.equal(auth.token, "");
  assert.deepEqual(redirects.at(-1), {
    path: "/login",
    query: { redirect: "/chat" },
  });
});
const record = {
  id: "1",
  type: "code-tool",
  title: "记录",
  model: "test",
  input: "const x = 1;",
  output: "## 建议\n保持清晰。",
  createdAt: "2026-09-28T12:00:00Z",
};
const report = {
  ...record, language: "TypeScript", reasoning: "分析接口\n```js\n示例\n```",
  running: false, stopped: false, error: "",
};
await test("Code report: preserves source, model, result and literal public reasoning", () => {
  const markdown = codeToolMarkdown(report);
  assert.ok(markdown.includes("- 模型：test"));
  assert.ok(markdown.includes("const x = 1;"));
  assert.ok(markdown.includes("## 建议\n保持清晰。"));
  assert.ok(markdown.includes("目标语言：TypeScript"));
  assert.ok(markdown.includes("\n````\n" + report.reasoning + "\n````\n"));
  assert.ok(markdown.includes("生成完成"));
});
await test("Code report: running, stopped and failed reports never claim success", () => {
  for (const state of [{ running: true }, { stopped: true }, { error: "服务中断" }]) {
    const markdown = codeToolMarkdown({ ...report, ...state });
    assert.ok(markdown.includes("内容可能不完整"));
    assert.ok(!markdown.includes("生成完成"));
  }
  assert.ok(codeToolMarkdown({ ...report, error: "服务中断" }).includes("服务中断"));
});
await test("Code report: content-only responses do not fabricate reasoning", () => {
  const markdown = codeToolMarkdown({ ...report, reasoning: "" });
  assert.ok(!markdown.includes("## 公开推理摘要"));
});
await test("Markdown: uses real newlines instead of escaped newline text", () => {
  const markdown = historyMarkdown(record);
  assert.ok(markdown.includes("\n\n## 输入\n\n"));
  assert.ok(!markdown.includes("\\n"));
  assert.ok(markdown.includes("## 建议\n保持清晰。"));
});
await test("Markdown: longer fences preserve source containing code fences", () => {
  const markdown = historyMarkdown({
    ...record,
    input: "```js\nalert(1)\n```",
  });
  assert.ok(markdown.includes("````\n```js\nalert(1)\n```\n````"));
});
await test("Markdown: unsafe filenames are sanitized and bounded", () => {
  assert.equal(safeFileName("a/b:c?d"), "a-b-c-d");
  assert.equal(safeFileName("  "), "ai-record");
  assert.equal(safeFileName("x".repeat(100)).length, 80);
});

globalThis.fetch = originalFetch;
delete globalThis.__sseAuth;
delete globalThis.__sseRouter;
