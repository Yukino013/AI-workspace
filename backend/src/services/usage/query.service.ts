import { DailyUsage, QuotaAccount, UsageRequest, DEFAULT_DAILY_LIMIT, MAX_ACTIVE_REQUESTS } from '../../models/usage.model.js';
import { ensureUsageReady, ensureAccount, updateQuota } from './quota.service.js';
import { quotaDate } from './rules.js';
import { AppError } from '../../utils/AppError.js';

function shiftDate(date: string, amount: number) {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year!, month! - 1, day! + amount) - 8 * 3600_000);
  return quotaDate(value);
}
function count(doc: Record<string, unknown> | null, key: string) { return Number(doc?.[key] ?? 0); }

export async function getUsageOverview(userId: string, days: 7 | 30 = 7) {
  await ensureUsageReady();
  await ensureAccount(userId);
  const today = quotaDate();
  const account = await QuotaAccount.findOne({ userId }).lean();
  const limit = account?.dailyTokenLimit ?? DEFAULT_DAILY_LIMIT;
  const from = shiftDate(today, -(days - 1));
  const [rows, sourceRows, modelRows] = await Promise.all([
    DailyUsage.find({ userId, quotaDate: { $gte: from, $lte: today } }).sort({ quotaDate: 1 }).lean(),
    UsageRequest.aggregate([{ $match: { userId, quotaDate: { $gte: from, $lte: today }, status: 'settled', startedAt: { $ne: null } } }, { $group: {
      _id: '$source', tokens: { $sum: '$chargedTokens' }, requests: { $sum: 1 }, estimated: { $sum: { $cond: [{ $eq: ['$usageSource', 'estimated'] }, 1, 0] } },
    } }, { $sort: { tokens: -1 } }]),
    UsageRequest.aggregate([{ $match: { userId, quotaDate: { $gte: from, $lte: today }, status: 'settled', startedAt: { $ne: null } } }, { $group: {
      _id: '$model', tokens: { $sum: '$chargedTokens' }, requests: { $sum: 1 },
    } }, { $sort: { tokens: -1 } }, { $limit: 10 }]),
  ]);
  const byDate = new Map(rows.map(row => [row.quotaDate, row]));
  const trend = Array.from({ length: days }, (_, index) => {
    const date = shiftDate(from, index);
    const row = byDate.get(date) as unknown as Record<string, unknown> | undefined;
    return { date, consumedTokens: count(row ?? null, 'consumedTokens'), reservedTokens: count(row ?? null, 'reservedTokens'), requests: count(row ?? null, 'startedRequests') };
  });
  const todayRow = byDate.get(today) as unknown as Record<string, unknown> | undefined;
  const consumed = count(todayRow ?? null, 'consumedTokens');
  const reserved = count(todayRow ?? null, 'reservedTokens');
  return {
    timezone: 'Asia/Shanghai', date: today,
    quota: { dailyLimit: limit, consumed, reserved, available: Math.max(0, limit - consumed - reserved), activeRequests: account?.activeRequests ?? 0, maxActiveRequests: MAX_ACTIVE_REQUESTS },
    today: {
      startedRequests: count(todayRow ?? null, 'startedRequests'), successRequests: count(todayRow ?? null, 'successRequests'),
      failedRequests: count(todayRow ?? null, 'failedRequests'), cancelledRequests: count(todayRow ?? null, 'cancelledRequests'),
      reportedInputTokens: count(todayRow ?? null, 'reportedInputTokens'), reportedOutputTokens: count(todayRow ?? null, 'reportedOutputTokens'),
      estimatedChargedTokens: count(todayRow ?? null, 'estimatedChargedTokens'),
    },
    trend,
    bySource: sourceRows.map(row => ({ source: String(row._id), tokens: Number(row.tokens ?? 0), requests: Number(row.requests ?? 0), estimatedRequests: Number(row.estimated ?? 0) })),
    byModel: modelRows.map(row => ({ model: String(row._id), tokens: Number(row.tokens ?? 0), requests: Number(row.requests ?? 0) })),
  };
}

export async function setDailyLimit(userId: string, limit: number) {
  return updateQuota(userId, limit);
}

export async function listUsageRecords(userId: string, input: { page: number; pageSize: number; source?: string; model?: string; date?: string }) {
  await ensureUsageReady();
  const filter: Record<string, unknown> = { userId };
  if (input.source) filter.source = input.source;
  if (input.model) filter.model = input.model;
  if (input.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) throw new AppError(400, 40001, '日期格式应为 YYYY-MM-DD');
    filter.quotaDate = input.date;
  }
  const [items, total] = await Promise.all([
    UsageRequest.find(filter).sort({ createdAt: -1 }).skip((input.page - 1) * input.pageSize).limit(input.pageSize).lean(),
    UsageRequest.countDocuments(filter),
  ]);
  return {
    items: items.map(item => ({
      id: item.requestId, date: item.quotaDate, source: item.source, sourceRef: item.sourceRef, model: item.model,
      status: item.status, outcome: item.outcome, reservedTokens: item.reservedTokens, chargedTokens: item.chargedTokens,
      usageSource: item.usageSource, reportedInputTokens: item.reportedInputTokens, reportedOutputTokens: item.reportedOutputTokens,
      reportedTotalTokens: item.reportedTotalTokens, recovered: item.recovered, errorCode: item.errorCode,
      createdAt: item.createdAt, finishedAt: item.finishedAt,
    })), total, page: input.page, pageSize: input.pageSize,
  };
}
