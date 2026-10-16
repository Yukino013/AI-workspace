import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

// config 在模块加载时读取 env，因此这些必须在动态 import 业务模块之前设置；
// 配合下面的 fetch stub，测试不会真的访问模型供应商。
process.env.DEEPSEEK_API_KEY = 'test-key';
process.env.QWEN_API_KEY = 'test-key';
process.env.ANTHROPIC_API_KEY = 'test-key';

// MongoDB 数据库名上限 63 字节，前缀必须短
const uri = process.env.USAGE_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true';
const database = `usage-entry-test-${randomUUID()}`;

const { AI_MODELS } = await import('../dist/services/ai/ai.service.js');
const { reserve, updateQuota } = await import('../dist/services/usage/quota.service.js');
const { DailyUsage, UsageRequest } = await import('../dist/models/usage.model.js');
const { runChat } = await import('../dist/services/chat.service.js');
const { runTool } = await import('../dist/services/code-tool.service.js');
const { createConversation, runMessage } = await import('../dist/services/conversation.service.js');
const { createWorkflowRun, executeWorkflowRun, retryWorkflowRun } = await import('../dist/services/workflow.service.js');
const { User } = await import('../dist/models/user.model.js');
const { Prompt } = await import('../dist/models/prompt.model.js');
const { ChatRecord } = await import('../dist/models/chat-record.model.js');
const { CodeToolRecord } = await import('../dist/models/code-tool-record.model.js');
const { ChatMessage } = await import('../dist/models/chat-message.model.js');
const { Workflow } = await import('../dist/models/workflow.model.js');
const { WorkflowRun } = await import('../dist/models/workflow-run.model.js');

const model = AI_MODELS.DEEPSEEK;

/** 每个用例使用真实用户：内置 Provider 的 Key 解析会按 _id 查 User 文档。 */
async function account() {
  const user = await User.create({ username: `usage-entry-${randomUUID()}`, password: randomUUID() });
  return String(user._id);
}

/** 队列式 fetch stub：按调用顺序取出下一个响应，未预期的调用直接失败。 */
const originalFetch = globalThis.fetch;
const queue = [];
const requestedModels = [];
const jsonReply = (content, usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { role: 'assistant', content } }], usage }),
  text: async () => '',
});
const sseReply = (text, usage = { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }) => {
  const encoder = new TextEncoder();
  const frames = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`,
    `data: ${JSON.stringify({ choices: [], usage })}\n\n`,
    'data: [DONE]\n\n',
  ];
  return {
    ok: true,
    status: 200,
    body: new ReadableStream({
      start(controller) {
        for (const frame of frames) controller.enqueue(encoder.encode(frame));
        controller.close();
      },
    }),
    text: async () => '',
  };
};
const failingReply = () => ({ ok: false, status: 502, text: async () => 'upstream down' });

before(async () => {
  await mongoose.connect(uri, { dbName: database, serverSelectionTimeoutMS: 5000 });
  globalThis.fetch = async (_url, init) => {
    requestedModels.push(JSON.parse(init.body).model);
    const next = queue.shift();
    assert.ok(next, '出现了测试未预期的模型调用：请检查响应队列');
    return next();
  };
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

async function twoStepWorkflow(userId) {
  return Workflow.create({
    userId,
    name: '两步流程',
    description: '',
    version: 1,
    steps: ['first', 'second'].map((id) => ({
      id,
      promptId: new mongoose.Types.ObjectId(),
      promptName: id,
      promptVersion: 1,
      promptContent: `请输出 ${id} 的结果`,
      variables: [],
      model,
      bindings: {},
    })),
  });
}

test('Prompt 入口：一次实际尝试对应一条已结算流水', async () => {
  const userId = await account();
  const prompt = await Prompt.create({ userId, name: '分析', content: '请分析：{{code}}', variables: ['code'], currentVersion: 1 });
  queue.push(() => jsonReply('分析完成', { prompt_tokens: 120, completion_tokens: 30, total_tokens: 150 }));

  await runChat(userId, { promptId: String(prompt._id), model, variables: { code: 'console.log(1)' } }, 'prompt-entry');

  const rows = await UsageRequest.find({ userId }).lean();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'prompt');
  assert.equal(rows[0].status, 'settled');
  assert.equal(rows[0].usageSource, 'reported');
  assert.equal(rows[0].chargedTokens, 150);
  assert.equal(rows[0].outcome, 'success');
  assert.ok(rows[0].reservedTokens >= 4096, '预占含单次最大输出');

  const day = await DailyUsage.findOne({ userId }).lean();
  assert.equal(day.consumedTokens, 150);
  assert.equal(day.reportedTokens, 150);
  assert.equal(day.startedRequests, 1);
  assert.equal(day.reservedTokens, 0);
  assert.equal(await ChatRecord.countDocuments({ userId }), 1);
});

test('额度不足时拒绝调用，且不留下业务记录', async () => {
  const userId = await account();
  await updateQuota(userId, 5000);
  // 先占掉大部分额度，制造“单次预占本身合法、但当日可用不足”的场景
  await reserve({ userId, source: 'prompt', sourceRef: 'blocker', model, operationKey: 'blocker' }, 4000);
  const prompt = await Prompt.create({ userId, name: '分析', content: '请分析：{{code}}', variables: ['code'], currentVersion: 1 });

  await assert.rejects(
    () => runChat(userId, { promptId: String(prompt._id), model, variables: { code: 'x' } }, 'rejected-prompt'),
    (error) => error.code === 42901,
  );
  assert.equal(await ChatRecord.countDocuments({ userId }), 0, '被拒绝的请求不能留下业务记录');
  assert.equal(await UsageRequest.countDocuments({ userId, operationKey: 'rejected-prompt' }), 0);

  const session = await createConversation(userId, model);
  await assert.rejects(() => runMessage(userId, session.id, '你好', 'rejected-conversation'), (error) => error.code === 42901);
  assert.equal(await ChatMessage.countDocuments({ sessionId: session.id }), 0, '额度拒绝时不能留下未发送的用户消息');
});

test('代码工具入口以 code_tool 来源计量', async () => {
  const userId = await account();
  queue.push(() => jsonReply('逐段解释……', { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }));

  await runTool(userId, 'explain', { model, code: 'const a = 1;' }, 'code-tool-entry');

  const rows = await UsageRequest.find({ userId }).lean();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].source, 'code_tool');
  assert.equal(rows[0].sourceRef, 'explain');
  assert.equal(rows[0].chargedTokens, 70);
  assert.equal(await CodeToolRecord.countDocuments({ userId }), 1);
});

test('对话入口按 conversation 来源计量并累计多轮消耗', async () => {
  const userId = await account();
  const session = await createConversation(userId, model);
  queue.push(() => jsonReply('第一次回答', { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 }));
  queue.push(() => jsonReply('第二次回答', { prompt_tokens: 60, completion_tokens: 12, total_tokens: 72 }));

  await runMessage(userId, session.id, '第一个问题', 'conversation-1');
  await runMessage(userId, session.id, '第二个问题', 'conversation-2');

  const rows = await UsageRequest.find({ userId }).sort({ createdAt: 1 }).lean();
  assert.deepEqual(rows.map((row) => row.source), ['conversation', 'conversation']);
  assert.deepEqual(rows.map((row) => row.chargedTokens), [40, 72]);
  assert.ok(rows[1].reservedTokens >= rows[0].reservedTokens, '第二轮预占包含历史上下文');

  const day = await DailyUsage.findOne({ userId }).lean();
  assert.equal(day.consumedTokens, 112);
  assert.equal(day.startedRequests, 2);
  assert.equal(await ChatMessage.countDocuments({ sessionId: session.id }), 4, '两轮各写一条用户消息与一条助手消息');
});

test('新 DeepSeek 调用使用官方模型名，旧会话模型名兼容映射', async () => {
  const userId = await account();
  const current = await createConversation(userId, AI_MODELS.DEEPSEEK);
  const legacy = await createConversation(userId, AI_MODELS.DEEPSEEK_LEGACY);
  queue.push(() => jsonReply('当前模型回答'));
  queue.push(() => jsonReply('兼容模型回答'));
  const start = requestedModels.length;

  await runMessage(userId, current.id, '使用当前模型', 'current-deepseek-model');
  await runMessage(userId, legacy.id, '继续旧模型会话', 'legacy-deepseek-model');

  assert.deepEqual(requestedModels.slice(start), [AI_MODELS.DEEPSEEK, AI_MODELS.DEEPSEEK]);
});

test('AI 对话调用失败时保留失败流水但不计入消耗', async () => {
  const userId = await account();
  const session = await createConversation(userId, model);
  queue.push(() => failingReply());

  await assert.rejects(() => runMessage(userId, session.id, '失败请求', 'failed-conversation'));

  const row = await UsageRequest.findOne({ userId, operationKey: 'failed-conversation' }).lean();
  assert.equal(row.outcome, 'error');
  assert.equal(row.usageSource, 'none');
  assert.equal(row.chargedTokens, 0);
  const day = await DailyUsage.findOne({ userId }).lean();
  assert.equal(day.consumedTokens, 0);
  assert.equal(day.reservedTokens, 0);
  assert.equal(day.failedRequests, 1);
});

test('工作流按实际执行步骤计量，重试不重复计量已成功步骤', async () => {
  const userId = await account();
  const workflow = await twoStepWorkflow(userId);

  const first = await createWorkflowRun(userId, String(workflow._id), {});
  queue.push(() => sseReply('第一步输出', { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }));
  queue.push(() => sseReply('第二步输出', { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 }));
  await executeWorkflowRun(userId, first.id, { signal: new AbortController().signal, onEvent: () => {} });

  const rows = await UsageRequest.find({ userId }).sort({ createdAt: 1 }).lean();
  assert.equal(rows.length, 2, '两步各一条流水，工作流本身不额外计量');
  assert.deepEqual(rows.map((row) => row.source), ['workflow', 'workflow']);
  assert.deepEqual(rows.map((row) => row.chargedTokens), [15, 28]);
  assert.deepEqual(rows.map((row) => row.operationKey), [`workflow:${first.id}:first`, `workflow:${first.id}:second`]);
  assert.equal((await WorkflowRun.findById(first.id).lean()).status, 'success');

  // 第二次运行：第二步失败，确认失败步骤可重试
  const failing = await createWorkflowRun(userId, String(workflow._id), {});
  queue.push(() => sseReply('第一步输出', { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }));
  queue.push(() => failingReply());
  await executeWorkflowRun(userId, failing.id, { signal: new AbortController().signal, onEvent: () => {} });

  const failed = await WorkflowRun.findById(failing.id).lean();
  assert.equal(failed.status, 'error');
  assert.deepEqual(failed.steps.map((step) => step.status), ['success', 'error']);

  const beforeRetry = await UsageRequest.countDocuments({ userId });
  const retried = await retryWorkflowRun(userId, String(workflow._id), failing.id);
  queue.push(() => sseReply('第二步重试输出', { prompt_tokens: 20, completion_tokens: 9, total_tokens: 29 }));
  await executeWorkflowRun(userId, retried.id, { signal: new AbortController().signal, onEvent: () => {} });

  assert.equal(await UsageRequest.countDocuments({ userId }) - beforeRetry, 1, '复用的成功步骤不重复计量');
  const retriedRun = await WorkflowRun.findById(retried.id).lean();
  assert.equal(retriedRun.status, 'success');
  assert.deepEqual(retriedRun.steps.map((step) => step.status), ['success', 'success']);
  assert.equal(retriedRun.steps[1].output, '第二步重试输出');
});
