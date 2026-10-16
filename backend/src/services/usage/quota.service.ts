import mongoose, { type ClientSession } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { QuotaAccount, DailyUsage, UsageRequest, UsageOperation, MAX_ACTIVE_REQUESTS, MAX_DAILY_LIMIT, REQUEST_TIMEOUT_MS } from '../../models/usage.model.js';
import { AppError } from '../../utils/AppError.js';
import type { TokenUsage } from '../ai/openai-client.js';
import { chargeFor, quotaDate } from './rules.js';

export type UsageSource = 'prompt' | 'conversation' | 'code_tool' | 'workflow';
export interface MeteringContext { userId: string; source: UsageSource; sourceRef: string; model: string; operationKey?: string }
let initializedDb: unknown;
let initializing: Promise<void> | undefined;
export async function ensureUsageReady() {
  if (mongoose.connection.readyState !== 1) throw new AppError(503, 50301, '计量数据库不可用，暂时无法调用 AI');
  if (initializedDb === mongoose.connection.db) return;
  if (!initializing) initializing = (async () => {
    const db = mongoose.connection.db!;
    const hello = await db.admin().command({ hello: 1 });
    if (!hello.setName && hello.msg !== 'isdbgrid') {
      throw new AppError(503, 50301, '额度管理需要 MongoDB 副本集；请按 README 配置本地数据库');
    }
    for (const model of [QuotaAccount, DailyUsage, UsageRequest, UsageOperation]) await model.createIndexes();
    initializedDb = db;
  })().finally(() => { initializing = undefined; });
  await initializing;
}
export async function transaction<T>(fn: (session: ClientSession) => Promise<T>) {
  await ensureUsageReady();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => fn(session), {
      readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, maxCommitTimeMS: 5000, timeoutMS: 10_000,
    }) as T;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Usage transaction failed', error instanceof Error ? error.name : 'unknown');
    throw new AppError(503, 50301, '额度结算暂不可用，请稍后刷新；未完成的请求会自动恢复');
  } finally { await session.endSession(); }
}
export async function ensureAccount(userId: string) {
  await ensureUsageReady();
  try { await QuotaAccount.updateOne({ userId }, { $setOnInsert: { userId } }, { upsert: true }); }
  catch (error) { if ((error as { code?: number }).code !== 11000) throw error; }
}
async function lockAccount(userId: string, session: ClientSession) {
  const account = await QuotaAccount.findOneAndUpdate({ userId }, { $inc: { mutationVersion: 1 } }, { new: true, session });
  if (!account) throw new AppError(503, 50301, '额度账户尚未初始化');
  return account;
}
export async function reserve(context: MeteringContext, tokens: number) {
  if (!Number.isSafeInteger(tokens) || tokens < 1) throw new AppError(400, 40001, '请求用量估算不合法');
  await ensureAccount(context.userId);
  const requestId = randomUUID();
  const operationKey = context.operationKey || requestId;
  return transaction(async session => {
    const account = await lockAccount(context.userId, session);
    if (await UsageRequest.exists({ userId: context.userId, operationKey }).session(session)) throw new AppError(409, 40901, '此请求已处理，请刷新记录；重新生成请发起新操作');
    if (account.activeRequests >= MAX_ACTIVE_REQUESTS) throw new AppError(429, 42902, '最多同时生成 3 个请求，请等待已有请求完成');
    if (tokens > account.dailyTokenLimit) throw new AppError(422, 42201, `本次预占需要 ${tokens} Token，超过每日预算，请缩短输入或调整预算`);
    const date = quotaDate();
    await DailyUsage.updateOne({ userId: context.userId, quotaDate: date }, {
      $setOnInsert: { dailyTokenLimit: account.dailyTokenLimit },
    }, { upsert: true, session });
    const daily = await DailyUsage.findOneAndUpdate({
      userId: context.userId, quotaDate: date,
      $expr: { $lte: [{ $add: ['$consumedTokens', '$reservedTokens', tokens] }, '$dailyTokenLimit'] },
    }, { $inc: { reservedTokens: tokens } }, { new: true, session });
    if (!daily) {
      const current = await DailyUsage.findOne({ userId: context.userId, quotaDate: date }).session(session);
      const available = Math.max(0, (current?.dailyTokenLimit ?? 0) - (current?.consumedTokens ?? 0) - (current?.reservedTokens ?? 0));
      throw new AppError(429, 42901, `本次预计需要 ${tokens} Token，今日可用 ${available} Token，请前往使用量与额度调整预算`);
    }
    await QuotaAccount.updateOne({ userId: context.userId }, { $inc: { activeRequests: 1 } }, { session });
    const [record] = await UsageRequest.create([{
      ...context, requestId, operationKey, model: context.model,
      quotaDate: date, reservedTokens: tokens, deadlineAt: new Date(Date.now() + REQUEST_TIMEOUT_MS),
    }], { session });
    return record!;
  });
}
export async function startAttempt(requestId: string) {
  return transaction(async session => {
    const record = await UsageRequest.findOne({ requestId }).session(session);
    if (!record || record.status !== 'reserved' || record.deadlineAt.getTime() <= Date.now()) throw new AppError(409, 40901, '请求已过期或处理');
    await lockAccount(record.userId, session);
    await UsageRequest.updateOne({ requestId, status: 'reserved' }, { $set: { status: 'running', startedAt: new Date() } }, { session });
    await DailyUsage.updateOne({ userId: record.userId, quotaDate: record.quotaDate }, { $inc: { startedRequests: 1 } }, { session });
  });
}
export async function settle(requestId: string, outcome: 'success' | 'error' | 'cancelled' | 'not_sent', usage?: TokenUsage, errorCode = '', recovered = false) {
  return transaction(async session => {
    const record = await UsageRequest.findOne({ requestId }).session(session);
    if (!record || record.status === 'settled') return;
    await lockAccount(record.userId, session);
    const wasStarted = record.status === 'running';
    const actualOutcome = wasStarted ? (outcome === 'not_sent' ? 'error' : outcome) : 'not_sent';
    const charge = wasStarted && actualOutcome !== 'error'
      ? chargeFor(record.reservedTokens, usage)
      : { charged: 0, source: 'none' };
    const reported = charge.source === 'reported';
    const increments: Record<string, number> = {
      reservedTokens: -record.reservedTokens, consumedTokens: charge.charged,
      reportedTokens: reported ? charge.charged : 0,
      estimatedChargedTokens: charge.source === 'estimated' ? charge.charged : 0,
      reportedInputTokens: reported ? usage!.promptTokens : 0,
      reportedOutputTokens: reported ? usage!.completionTokens : 0,
    };
    if (wasStarted) increments[actualOutcome === 'success' ? 'successRequests' : actualOutcome === 'cancelled' ? 'cancelledRequests' : 'failedRequests'] = 1;
    await UsageRequest.updateOne({ requestId, status: record.status }, { $set: {
      status: 'settled', outcome: actualOutcome, chargedTokens: charge.charged, usageSource: charge.source,
      reportedInputTokens: reported ? usage!.promptTokens : null, reportedOutputTokens: reported ? usage!.completionTokens : null,
      reportedTotalTokens: reported ? usage!.totalTokens : null, finishedAt: new Date(),
      durationMs: record.startedAt ? Date.now() - record.startedAt.getTime() : 0, errorCode, recovered,
    } }, { session });
    await DailyUsage.updateOne({ userId: record.userId, quotaDate: record.quotaDate }, { $inc: increments }, { session });
    await QuotaAccount.updateOne({ userId: record.userId }, { $inc: { activeRequests: -1 } }, { session });
  });
}
export async function updateQuota(userId: string, limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_DAILY_LIMIT) throw new AppError(400, 40001, `每日额度必须为 1～${MAX_DAILY_LIMIT} 的整数`);
  await ensureAccount(userId);
  return transaction(async session => {
    await lockAccount(userId, session);
    const date = quotaDate();
    const daily = await DailyUsage.findOne({ userId, quotaDate: date }).session(session);
    if (daily && limit < daily.consumedTokens + daily.reservedTokens) throw new AppError(422, 42202, '新预算不能低于今日已消耗与预占的合计');
    await QuotaAccount.updateOne({ userId }, { $set: { dailyTokenLimit: limit } }, { session });
    await DailyUsage.updateOne({ userId, quotaDate: date }, { $set: { dailyTokenLimit: limit } }, { upsert: true, session });
    return { dailyTokenLimit: limit };
  });
}
export async function recoverUsage(now = new Date()) {
  await ensureUsageReady();
  const stale = await UsageRequest.find({ status: { $in: ['reserved', 'running'] }, deadlineAt: { $lt: new Date(now.getTime() - 30_000) } }).limit(100).lean();
  for (const item of stale) await settle(item.requestId, 'error', undefined, 'RECOVERED_TIMEOUT', true);
  await UsageOperation.updateMany({ active: true, expiresAt: { $lt: now } }, { $set: { active: false } });
  return stale.length;
}
