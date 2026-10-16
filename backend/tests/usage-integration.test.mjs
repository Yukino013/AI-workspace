import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

// 额度扣减依赖多文档事务，必须连到副本集（或 mongos）；缺省用本地临时副本集端口。
const uri = process.env.USAGE_TEST_MONGO_URI ?? 'mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true';
const database = `ai-workbench-usage-test-${randomUUID()}`;

const { reserve, startAttempt, settle, updateQuota, recoverUsage } = await import('../dist/services/usage/quota.service.js');
const { DailyUsage, QuotaAccount, UsageRequest, DEFAULT_DAILY_LIMIT } = await import('../dist/models/usage.model.js');
const { quotaDate } = await import('../dist/services/usage/rules.js');
const { AI_MODELS, AIService } = await import('../dist/services/ai/ai.service.js');
const { getUsageOverview, listUsageRecords } = await import('../dist/services/usage/query.service.js');

const user = () => `user-${randomUUID()}`;
const context = (userId, operationKey) => ({
  userId,
  source: 'prompt',
  sourceRef: 'prompt-ref',
  model: AI_MODELS.DEEPSEEK,
  operationKey,
});
const usage = (promptTokens, completionTokens, totalTokens = promptTokens + completionTokens, complete = true) => ({
  promptTokens,
  completionTokens,
  totalTokens,
  complete,
});
const code = (error) => error?.code;
const daily = (userId, date = quotaDate()) => DailyUsage.findOne({ userId, quotaDate: date }).lean();
const account = (userId) => QuotaAccount.findOne({ userId }).lean();
const record = (requestId) => UsageRequest.findOne({ requestId }).lean();

before(async () => {
  try {
    await mongoose.connect(uri, { dbName: database, serverSelectionTimeoutMS: 5000 });
  } catch (error) {
    throw new Error(
      `无法连接测试 MongoDB（${uri}）。额度事务测试需要副本集，请先启动临时单节点副本集：\n` +
        '  mongod --replSet rs0 --port 27018 --dbpath <临时目录> --bind_ip 127.0.0.1 --fork --logpath <日志>\n' +
        "  mongosh --port 27018 --eval 'rs.initiate()'\n" +
        `原始错误：${error instanceof Error ? error.message : error}`,
    );
  }
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    throw new Error('连接到的 MongoDB 既不是副本集也不是 mongos，无法运行事务测试；请按 README 启动本地单节点副本集。');
  }
});

after(async () => {
  if (mongoose.connection.name === database) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('预占 → 开始尝试 → 成功结算：额度从预占转为实际消耗', async () => {
  const userId = user();
  const reserved = await reserve(context(userId, 'settle-success'), 1000);

  let day = await daily(userId);
  assert.equal(day.reservedTokens, 1000);
  assert.equal(day.dailyTokenLimit, DEFAULT_DAILY_LIMIT, '首次使用按默认每日额度建立当日汇总');
  assert.equal((await account(userId)).activeRequests, 1);
  assert.equal((await record(reserved.requestId)).status, 'reserved');

  await startAttempt(reserved.requestId);
  day = await daily(userId);
  assert.equal(day.startedRequests, 1);
  assert.equal((await record(reserved.requestId)).status, 'running');

  await settle(reserved.requestId, 'success', usage(800, 400));
  day = await daily(userId);
  assert.equal(day.reservedTokens, 0);
  assert.equal(day.consumedTokens, 1200);
  assert.equal(day.reportedTokens, 1200);
  assert.equal(day.reportedInputTokens, 800);
  assert.equal(day.reportedOutputTokens, 400);
  assert.equal(day.successRequests, 1);
  assert.equal((await account(userId)).activeRequests, 0);

  const settled = await record(reserved.requestId);
  assert.equal(settled.status, 'settled');
  assert.equal(settled.outcome, 'success');
  assert.equal(settled.usageSource, 'reported');
  assert.equal(settled.chargedTokens, 1200);
});

test('同一幂等键不会二次预占，重复结算只生效一次', async () => {
  const userId = user();
  const reserved = await reserve(context(userId, 'idempotent-key'), 500);
  await assert.rejects(() => reserve(context(userId, 'idempotent-key'), 500), (error) => code(error) === 40901);

  assert.equal(await UsageRequest.countDocuments({ userId }), 1);
  assert.equal((await daily(userId)).reservedTokens, 500);

  await startAttempt(reserved.requestId);
  await settle(reserved.requestId, 'success', usage(100, 50));
  await settle(reserved.requestId, 'success', usage(9999, 9999));

  const day = await daily(userId);
  assert.equal(day.consumedTokens, 150, '第二次结算必须是幂等的空操作');
  assert.equal(day.reservedTokens, 0);
  assert.equal((await account(userId)).activeRequests, 0, '并发计数不能被减成负数');
  assert.equal((await record(reserved.requestId)).chargedTokens, 150);
});

test('每用户同时最多 3 个进行中的请求', async () => {
  const userId = user();
  const results = await Promise.allSettled([1, 2, 3, 4].map((index) => reserve(context(userId, `concurrent-${index}`), 100)));

  const fulfilled = results.filter((item) => item.status === 'fulfilled');
  const rejected = results.filter((item) => item.status === 'rejected');
  assert.equal(fulfilled.length, 3);
  assert.equal(rejected.length, 1);
  assert.equal(code(rejected[0].reason), 42902);
  assert.equal((await account(userId)).activeRequests, 3);
  assert.equal((await daily(userId)).reservedTokens, 300, '被拒绝的请求不能占用额度');
});

test('单次超预算与当日额度不足返回不同错误', async () => {
  const userId = user();
  await updateQuota(userId, 5000);

  await assert.rejects(() => reserve(context(userId, 'over-budget'), 6000), (error) => code(error) === 42201);
  await reserve(context(userId, 'within-budget'), 3000);
  await assert.rejects(() => reserve(context(userId, 'no-remaining'), 3000), (error) => code(error) === 42901);

  const day = await daily(userId);
  assert.equal(day.reservedTokens, 3000);
});

test('预算不能降到低于今日已消耗与预占的合计', async () => {
  const userId = user();
  const reserved = await reserve(context(userId, 'budget-lower'), 2000);
  await startAttempt(reserved.requestId);
  await settle(reserved.requestId, 'success', usage(1500, 500));

  await assert.rejects(() => updateQuota(userId, 1500), (error) => code(error) === 42202);
  assert.deepEqual(await updateQuota(userId, 2_000_000), { dailyTokenLimit: 2_000_000 });

  const day = await daily(userId);
  assert.equal(day.dailyTokenLimit, 2_000_000, '当日预算快照同步更新');
  assert.equal(day.consumedTokens, 2000, '已消耗额度不因调整预算而改变');
});

test('结算沿用预占时固定的额度日，跨零点不回写当天', async () => {
  const userId = user();
  const reserved = await reserve(context(userId, 'cross-midnight'), 1000);
  const past = '2026-01-01';

  // 模拟“预占发生在历史额度日”：把流水与当日汇总一起搬到过去那一天
  await UsageRequest.updateOne({ requestId: reserved.requestId }, { $set: { quotaDate: past } });
  await DailyUsage.updateOne({ userId, quotaDate: quotaDate() }, { $inc: { reservedTokens: -1000 } });
  await DailyUsage.create({ userId, quotaDate: past, dailyTokenLimit: DEFAULT_DAILY_LIMIT, reservedTokens: 1000 });

  await startAttempt(reserved.requestId);
  await settle(reserved.requestId, 'success', usage(100, 50));

  const history = await daily(userId, past);
  const today = await daily(userId);
  assert.equal(history.consumedTokens, 150);
  assert.equal(history.reservedTokens, 0);
  assert.equal(history.startedRequests, 1);
  assert.equal(today.consumedTokens, 0, '已有记录的额度日不会被改写');
  assert.equal(today.reservedTokens, 0);
});

test('恢复任务释放尚未取得执行资格的预占', async () => {
  const userId = user();
  const reserved = await reserve(context(userId, 'recover-reserved'), 700);
  await UsageRequest.updateOne({ requestId: reserved.requestId }, { $set: { deadlineAt: new Date(Date.now() - 60_000) } });

  await recoverUsage();

  const doc = await record(reserved.requestId);
  assert.equal(doc.status, 'settled');
  assert.equal(doc.outcome, 'not_sent', '未转为 running 的流水可确认没有发送过');
  assert.equal(doc.chargedTokens, 0);
  assert.equal(doc.recovered, true);

  const day = await daily(userId);
  assert.equal(day.reservedTokens, 0);
  assert.equal(day.startedRequests, 0, '没有发送过的请求不计调用次数');
  assert.equal((await account(userId)).activeRequests, 0);
});

test('恢复任务将结果未知的失败尝试作为零消耗结算', async () => {
  const userId = user();
  const reserved = await reserve(context(userId, 'recover-running'), 900);
  await startAttempt(reserved.requestId);
  await UsageRequest.updateOne({ requestId: reserved.requestId }, { $set: { deadlineAt: new Date(Date.now() - 60_000) } });

  await recoverUsage();

  const doc = await record(reserved.requestId);
  assert.equal(doc.outcome, 'error');
  assert.equal(doc.usageSource, 'none');
  assert.equal(doc.chargedTokens, 0);

  const day = await daily(userId);
  assert.equal(day.consumedTokens, 0);
  assert.equal(day.estimatedChargedTokens, 0);
  assert.equal(day.reservedTokens, 0);
  assert.equal(day.failedRequests, 1);
  assert.equal((await account(userId)).activeRequests, 0);
});

test('失败请求即使带有 Token 用量也不计入额度', async () => {
  const userId = user();
  const reserved = await reserve(context(userId, 'failed-with-usage'), 900);
  await startAttempt(reserved.requestId);

  await settle(reserved.requestId, 'error', usage(300, 100));

  const doc = await record(reserved.requestId);
  assert.equal(doc.outcome, 'error');
  assert.equal(doc.usageSource, 'none');
  assert.equal(doc.chargedTokens, 0);
  assert.equal(doc.reportedTotalTokens, null);
  const day = await daily(userId);
  assert.equal(day.consumedTokens, 0);
  assert.equal(day.reportedTokens, 0);
  assert.equal(day.reservedTokens, 0);
  assert.equal(day.failedRequests, 1);
});

test('startAttempt 失败时非流式调用释放预占', async () => {
  const userId = user();
  const params = { model: AI_MODELS.DEEPSEEK, messages: [{ role: 'user', content: 'hello' }] };
  const metering = context(userId, 'chat-release');
  const ticket = await AIService.prepare(params, metering);
  await UsageRequest.updateOne({ requestId: ticket.requestId }, { $set: { deadlineAt: new Date(Date.now() - 1000) } });

  await assert.rejects(() => AIService.chat(params, metering, ticket), (error) => code(error) === 40901);

  const doc = await record(ticket.requestId);
  assert.equal(doc.status, 'settled');
  assert.equal(doc.outcome, 'not_sent');
  assert.equal(doc.chargedTokens, 0);
  assert.equal((await daily(userId)).reservedTokens, 0, '预占必须立即释放，不能留在 reserved 上');
  assert.equal((await account(userId)).activeRequests, 0);
});

test('startAttempt 失败时流式调用释放预占', async () => {
  const userId = user();
  const params = { model: AI_MODELS.DEEPSEEK, messages: [{ role: 'user', content: 'hello' }] };
  const metering = context(userId, 'stream-release');
  const ticket = await AIService.prepare(params, metering);
  await UsageRequest.updateOne({ requestId: ticket.requestId }, { $set: { deadlineAt: new Date(Date.now() - 1000) } });

  const consume = async () => {
    for await (const _event of AIService.stream(params, new AbortController().signal, metering, ticket)) {
      // 不应产生任何增量事件
    }
  };
  await assert.rejects(consume, (error) => code(error) === 40901);

  const doc = await record(ticket.requestId);
  assert.equal(doc.status, 'settled');
  assert.equal(doc.outcome, 'not_sent');
  assert.equal((await daily(userId)).reservedTokens, 0);
  assert.equal((await account(userId)).activeRequests, 0);
});

test('用户之间额度、流水与汇总相互隔离', async () => {
  const owner = user();
  const stranger = user();
  const reserved = await reserve(context(owner, 'isolation'), 800);
  await startAttempt(reserved.requestId);
  await settle(reserved.requestId, 'success', usage(600, 200));

  const overview = await getUsageOverview(stranger, 7);
  assert.equal(overview.quota.consumed, 0);
  assert.equal(overview.quota.reserved, 0);
  assert.equal(overview.today.startedRequests, 0);
  assert.deepEqual(overview.bySource, []);
  assert.deepEqual(overview.byModel, []);

  const page = await listUsageRecords(stranger, { page: 1, pageSize: 20 });
  assert.equal(page.total, 0);
  assert.deepEqual(page.items, []);

  const own = await listUsageRecords(owner, { page: 1, pageSize: 20 });
  assert.equal(own.total, 1);
  assert.equal(own.items[0].chargedTokens, 800);
  assert.equal(own.items[0].usageSource, 'reported');
});

test('额度拒绝不会写入任何流水，未鉴权用户无法读取他人数据', async () => {
  const userId = user();
  await updateQuota(userId, 100);
  await assert.rejects(() => reserve(context(userId, 'rejected'), 5000), (error) => code(error) === 42201);
  assert.equal(await UsageRequest.countDocuments({ userId }), 0, '被拒绝的请求不产生流水');
  assert.equal((await daily(userId)).reservedTokens, 0);
  assert.equal((await account(userId)).activeRequests, 0);
});
