import type { Request, Response } from 'express';
import { z } from 'zod';
import { getUsageOverview, listUsageRecords, setDailyLimit } from '../services/usage/query.service.js';
import { AppError } from '../utils/AppError.js';
import { ok } from '../utils/response.js';
const overviewQuery = z.object({ days: z.coerce.number().refine(n => n === 7 || n === 30).default(7) });
const recordsQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  source: z.enum(['prompt', 'conversation', 'code_tool', 'workflow']).optional(),
  model: z.string().min(1).max(100).optional(),
  date: z.iso.date().optional(),
});
export async function overview(req: Request, res: Response) {
  const query = overviewQuery.safeParse(req.query);
  if (!query.success) throw new AppError(400, 40001, '统计天数仅支持 7 或 30');
  res.json(ok(await getUsageOverview(req.user!.userId, query.data.days as 7 | 30)));
}
export async function records(req: Request, res: Response) {
  const query = recordsQuery.safeParse(req.query);
  if (!query.success) throw new AppError(400, 40001, '筛选参数不合法，请检查日期、来源和页码');
  res.json(ok(await listUsageRecords(req.user!.userId, query.data)));
}
export async function update(req: Request, res: Response) {
  res.json(ok(await setDailyLimit(req.user!.userId, req.body.dailyTokenLimit)));
}
