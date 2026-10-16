import { createHash, randomUUID } from 'node:crypto';
import type { Request, Response, RequestHandler } from 'express';
import { UsageOperation, REQUEST_TIMEOUT_MS } from '../../models/usage.model.js';
import { AppError } from '../../utils/AppError.js';
import { ensureUsageReady } from './quota.service.js';

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]),
  );
  return value;
}
function payloadHash(req: Request) {
  return createHash('sha256').update(JSON.stringify(stable({ method: req.method, path: req.originalUrl.split('?')[0], body: req.body }))).digest('hex');
}

/** Claims an idempotency key before a generation mutates messages or workflow runs. */
export function withUsageOperation(handler: (req: Request, res: Response) => Promise<void>, resource?: (req: Request) => string): RequestHandler {
  return async (req, res, next) => {
    const userId = req.user!.userId;
    const key = req.get('Idempotency-Key')?.trim() || randomUUID();
    if (key.length > 128) return next(new AppError(400, 40001, 'Idempotency-Key 最长 128 个字符'));
    const hash = payloadHash(req);
    const resourceKey = resource?.(req) ?? `operation:${key}`;
    let operationId: string | undefined;
    try {
      await ensureUsageReady();
      const doc = await UsageOperation.create({
        userId, operationKey: key, payloadHash: hash, resourceKey,
        // 锁只在本次请求期间有意义：比单次请求时限多留一分钟，进程崩溃后也能较快重试。
        active: true, expiresAt: new Date(Date.now() + REQUEST_TIMEOUT_MS + 60_000),
      });
      operationId = String(doc._id);
      req.headers['idempotency-key'] = key;
      await handler(req, res);
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        const sameKey = await UsageOperation.findOne({ userId, operationKey: key }).lean();
        if (sameKey) {
          if (sameKey.payloadHash !== hash) return next(new AppError(409, 40902, '该幂等键已用于不同请求，请重新发起操作'));
          return next(new AppError(409, 40901, sameKey.active ? '相同请求正在处理中' : '该请求已处理；如需重新生成，请发起新操作'));
        }
        return next(new AppError(409, 40903, '该资源已有生成任务正在处理，请等待完成后重试'));
      }
      if (error instanceof AppError) return next(error);
      return next(error);
    } finally {
      if (operationId) {
        await UsageOperation.updateOne({ _id: operationId }, { $set: { active: false, expiresAt: new Date() } }).catch((error) => {
          console.error('Usage operation release failed', error instanceof Error ? error.name : 'unknown');
        });
      }
    }
  };
}
