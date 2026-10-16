import { AppError } from '../../utils/AppError.js';
import { deepseekAdapter } from './deepseek.adapter.js';
import { qwenAdapter } from './qwen.adapter.js';
import { anthropicAdapter } from './anthropic.adapter.js';
import type { AIAdapter, ChatParams, ChatResult, StreamEvent, TokenUsage } from './openai-client.js';
import { MAX_OUTPUT_TOKENS, REQUEST_TIMEOUT_MS } from '../../models/usage.model.js';
import { estimateReservation } from '../usage/rules.js';
import { reserve, settle, startAttempt, type MeteringContext } from '../usage/quota.service.js';
export type { MeteringContext } from '../usage/quota.service.js';
export const AI_MODELS = {
  DEEPSEEK: 'deepseek-flash',
  DEEPSEEK_LEGACY: 'deepseek-v4-flash',
  QWEN: 'qwen-plus',
  ANTHROPIC: 'claude-sonnet-5',
} as const;
const adapters: Record<string, AIAdapter> = {
  [AI_MODELS.DEEPSEEK]: deepseekAdapter,
  [AI_MODELS.DEEPSEEK_LEGACY]: deepseekAdapter,
  [AI_MODELS.QWEN]: qwenAdapter,
  [AI_MODELS.ANTHROPIC]: anthropicAdapter,
};
function providerParams(params: ChatParams): ChatParams {
  return params.model === AI_MODELS.DEEPSEEK_LEGACY
    ? { ...params, model: AI_MODELS.DEEPSEEK }
    : params;
}
function adapter(model: string) {
  const selected = adapters[model];
  if (!selected) throw new AppError(400, 40001, `不支持的模型：${model}`);
  return selected;
}
export interface PreparedCall { requestId: string; userId: string; model: string }
export async function prepareAICall(params: ChatParams, context: MeteringContext): Promise<PreparedCall> {
  adapter(params.model);
  if (context.model !== params.model) throw new AppError(400, 40001, '模型与计量上下文不一致');
  const record = await reserve(context, estimateReservation(params.messages));
  return { requestId: record.requestId, userId: context.userId, model: context.model };
}
function checkTicket(ticket: PreparedCall, context: MeteringContext) {
  if (ticket.userId !== context.userId || ticket.model !== context.model) throw new AppError(400, 40001, '计量凭证不匹配');
}
/** 异常路径上的结算：失败不覆盖原始错误，未完成的流水留给恢复任务兜底。 */
async function settleSafely(requestId: string, outcome: 'success' | 'error' | 'cancelled' | 'not_sent', usage?: TokenUsage) {
  try { await settle(requestId, outcome, usage); }
  catch (error) { console.error('用量结算失败，等待恢复任务处理', error instanceof Error ? error.name : 'unknown'); }
}
function linkedSignal(original?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (original?.aborted) abort();
  original?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS); timer.unref();
  return { signal: controller.signal, close: () => { clearTimeout(timer); original?.removeEventListener('abort', abort); } };
}
/** All model calls must provide trusted server-side metering context. */
export const AIService = {
  prepare: prepareAICall,
  async chat(params: ChatParams, context: MeteringContext, prepared?: PreparedCall): Promise<ChatResult> {
    const ticket = prepared ?? await prepareAICall(params, context); checkTicket(ticket, context);
    const linked = linkedSignal(params.signal); let started = false; let usage: TokenUsage | undefined;
    try {
      linked.signal.throwIfAborted();
      await startAttempt(ticket.requestId);
      started = true;
      linked.signal.throwIfAborted();
      const result = await adapter(params.model).chat({ ...providerParams(params), signal: linked.signal, maxTokens: MAX_OUTPUT_TOKENS });
      usage = result.usage; await settle(ticket.requestId, 'success', usage); return result;
    } catch (error) {
      // 未取得执行资格（含 startAttempt 失败）时必须主动释放预占，避免额度卡在 reserved 上。
      await settleSafely(ticket.requestId, started ? (linked.signal.aborted ? 'cancelled' : 'error') : 'not_sent', usage);
      throw error;
    }
    finally { linked.close(); }
  },
  async *stream(params: ChatParams, signal: AbortSignal, context: MeteringContext, prepared?: PreparedCall): AsyncGenerator<StreamEvent> {
    const ticket = prepared ?? await prepareAICall(params, context); checkTicket(ticket, context);
    const linked = linkedSignal(signal); let started = false; let settled = false; let usage: TokenUsage | undefined;
    try {
      if (linked.signal.aborted) { await settle(ticket.requestId, 'not_sent'); settled = true; linked.signal.throwIfAborted(); }
      try { await startAttempt(ticket.requestId); }
      catch (error) { settled = true; await settleSafely(ticket.requestId, 'not_sent', usage); throw error; }
      started = true;
      for await (const event of adapter(params.model).stream({ ...providerParams(params), maxTokens: MAX_OUTPUT_TOKENS }, linked.signal)) {
        if (event.type === 'done') usage = event.usage; else yield event;
      }
      linked.signal.throwIfAborted();
      await settle(ticket.requestId, 'success', usage); settled = true;
      if (!linked.signal.aborted) yield { type: 'done', usage: usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0, complete: false } };
    } catch (error) { if (!settled) await settleSafely(ticket.requestId, started ? (linked.signal.aborted ? 'cancelled' : 'error') : 'not_sent', usage); settled = true; throw error; }
    finally { try { if (!settled) await settleSafely(ticket.requestId, started ? 'cancelled' : 'not_sent', usage); } finally { linked.close(); } }
  },
};
