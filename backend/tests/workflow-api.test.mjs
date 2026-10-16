import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

const database = `ai-workbench-workflow-test-${randomUUID()}`;
// 生成类接口一律先经过额度预占，需要多文档事务，因此测试库必须连副本集
const uri = process.env.USAGE_TEST_MONGO_URI ?? "mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true";
process.env.JWT_SECRET = randomUUID() + randomUUID();
process.env.JWT_EXPIRES_IN = "1h";
process.env.DEEPSEEK_API_KEY = "workflow-test-key";
const { default: app } = await import("../dist/app.js");
const { Prompt } = await import("../dist/models/prompt.model.js");
const { Workflow } = await import("../dist/models/workflow.model.js");
const { WorkflowRun } = await import("../dist/models/workflow-run.model.js");
let server;
let base;
let token;
let otherToken;

before(async () => {
  await mongoose.connect(uri, { dbName: database, serverSelectionTimeoutMS: 5000 });
  await Promise.all([Prompt.init(), Workflow.init(), WorkflowRun.init()]);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  base = `http://127.0.0.1:${server.address().port}/api`;
  token = await account("workflow_user");
  otherToken = await account("workflow_other");
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (server) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const originalFetch = globalThis.fetch;

async function request(path, { authToken = token, method = "GET", body } = {}) {
  const response = await originalFetch(`${base}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(authToken ? { Authorization: ["Bearer", authToken].join(" ") } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}

async function account(username) {
  const credentials = { username, password: "workflow-test-password-123" };
  assert.equal((await request("/auth/register", { authToken: undefined, method: "POST", body: credentials })).status, 201);
  return (await request("/auth/login", { authToken: undefined, method: "POST", body: credentials })).body.data.token;
}

function readEvents(text) {
  return text.split(/\r?\n\r?\n/).flatMap((event) => {
    const line = event.split(/\r?\n/).find((entry) => entry.startsWith("data: "));
    if (!line || line === "data: [DONE]") return [];
    return [JSON.parse(line.slice(6))];
  });
}

test("workflow API snapshots owned prompts, executes sequentially, and retries only the failed step", async () => {
  const firstPrompt = await request("/prompts", {
    method: "POST",
    body: { name: "Draft", content: "Draft {{topic}}" },
  });
  const secondPrompt = await request("/prompts", {
    method: "POST",
    body: { name: "Review", content: "Review {{draft}} in {{tone}}" },
  });
  assert.equal(firstPrompt.status, 201);
  assert.equal(secondPrompt.status, 201);

  const workflowResponse = await request("/workflows", {
    method: "POST",
    body: {
      name: "Draft and review",
      description: "Two sequential prompt calls",
      steps: [
        {
          id: "draft",
          promptId: firstPrompt.body.data.id,
          model: "deepseek-v4-flash",
          bindings: { topic: "input.topic" },
        },
        {
          id: "review",
          promptId: secondPrompt.body.data.id,
          model: "deepseek-v4-flash",
          bindings: { draft: "steps.draft.output", tone: "input.tone" },
        },
      ],
    },
  });
  assert.equal(workflowResponse.status, 201, JSON.stringify(workflowResponse.body));
  const workflow = workflowResponse.body.data;
  assert.equal(workflow.steps[0].promptVersion, 1);
  assert.equal(workflow.steps[1].bindings.draft, "steps.draft.output");
  assert.equal((await request(`/workflows/${workflow.id}`, { authToken: otherToken })).status, 404);

  const missingInput = await request(`/workflows/${workflow.id}/runs/stream`, {
    method: "POST",
    body: { inputs: { topic: "A topic" } },
  });
  assert.equal(missingInput.status, 400);

  let failFirstReview = true;
  let holdNextDraft = false;
  const modelInputs = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("https://api.deepseek.com/")) {
      assert.equal(init.headers.Authorization, "Bearer workflow-test-key");
      const input = JSON.parse(init.body).messages[0].content;
      modelInputs.push(input);
      if (input.startsWith("Draft") && holdNextDraft) {
        holdNextDraft = false;
        const signal = init.signal;
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ choices: [{ delta: { content: "partial" } }] })}\n\n`));
              signal.addEventListener("abort", () => controller.error(new DOMException("Aborted", "AbortError")), { once: true });
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        );
      }
      if (input.includes("Review") && failFirstReview) {
        failFirstReview = false;
        return new Response("temporary provider failure", { status: 503 });
      }
      const content = input.startsWith("Draft") ? "draft-output" : "reviewed-output";
      return new Response(
        [
          `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
          `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 } })}\n\n`,
          "data: [DONE]\n\n",
        ].join(""),
        { headers: { "Content-Type": "text/event-stream" } },
      );
    }
    return originalFetch(url, init);
  };

  const failedResponse = await originalFetch(`${base}/workflows/${workflow.id}/runs/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: ["Bearer", token].join(" ") },
    body: JSON.stringify({ inputs: { topic: "A topic", tone: "concise" } }),
  });
  assert.equal(failedResponse.status, 200);
  const failedEvents = readEvents(await failedResponse.text());
  const failedRun = failedEvents.find((event) => event.type === "run-start").run;
  assert.equal(failedEvents.find((event) => event.type === "step-error").stepId, "review");
  assert.equal(failedRun.steps[0].status, "pending");
  const failedHistory = await request(`/workflows/${workflow.id}/runs`);
  assert.equal(failedHistory.body.data.items[0].status, "error");
  assert.equal(failedHistory.body.data.items[0].steps[0].status, "success");
  assert.equal(failedHistory.body.data.items[0].steps[0].tokenUsage.totalTokens, 19);

  const retryResponse = await originalFetch(`${base}/workflows/${workflow.id}/runs/${failedHistory.body.data.items[0].id}/retry/stream`, {
    method: "POST",
    headers: { Authorization: ["Bearer", token].join(" ") },
    body: "{}",
  });
  assert.equal(retryResponse.status, 200);
  const retryEvents = readEvents(await retryResponse.text());
  assert.equal(retryEvents.find((event) => event.type === "run-complete").status, "success");
  assert.deepEqual(modelInputs, ["Draft A topic", "Review draft-output in concise", "Review draft-output in concise"]);
  const history = await request(`/workflows/${workflow.id}/runs`);
  assert.equal(history.body.data.items[0].status, "success");
  assert.equal(history.body.data.items[0].retryOfRunId, failedHistory.body.data.items[0].id);

  const updateResponse = await request(`/workflows/${workflow.id}`, {
    method: "PUT",
    body: {
      name: workflow.name,
      description: "Updated flow",
      steps: workflow.steps.map(({ id, promptId, model, bindings }) => ({ id, promptId, model, bindings })),
    },
  });
  assert.equal(updateResponse.status, 200, JSON.stringify(updateResponse.body));
  assert.equal(updateResponse.body.data.version, 2);
  assert.equal((await request(`/workflows/${workflow.id}/runs`)).body.data.items[0].workflowVersion, 1);

  holdNextDraft = true;
  const abortController = new AbortController();
  const cancelledResponse = await originalFetch(`${base}/workflows/${workflow.id}/runs/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: ["Bearer", token].join(" ") },
    body: JSON.stringify({ inputs: { topic: "A topic", tone: "concise" } }),
    signal: abortController.signal,
  });
  const reader = cancelledResponse.body.getReader();
  const decoder = new TextDecoder();
  let streamed = "";
  while (!streamed.includes('"text":"partial"')) {
    const { done, value } = await reader.read();
    assert.equal(done, false, "the provider stream should remain open until cancelled");
    streamed += decoder.decode(value, { stream: true });
  }
  abortController.abort();
  await reader.cancel().catch(() => {});
  let cancelledRun;
  for (let attempt = 0; attempt < 20; attempt++) {
    const latestRuns = await request(`/workflows/${workflow.id}/runs`);
    cancelledRun = latestRuns.body.data.items.find((run) => run.status === "aborted");
    if (cancelledRun) break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(cancelledRun?.steps[0].status, "aborted");

  assert.equal((await request(`/workflows/${workflow.id}`, { method: "DELETE" })).status, 200);
  assert.equal(await Workflow.countDocuments({ _id: workflow.id }), 0);
  assert.equal(await WorkflowRun.countDocuments({ workflowId: workflow.id }), 0);
});
