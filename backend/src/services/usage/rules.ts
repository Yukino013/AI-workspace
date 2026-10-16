import type { ChatMessage, TokenUsage } from '../ai/openai-client.js';
import { MAX_OUTPUT_TOKENS } from '../../models/usage.model.js';
export const TIMEZONE = 'Asia/Shanghai';
export function quotaDate(date = new Date()) {
  return new Date(date.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
}
export function estimateReservation(messages: ChatMessage[]) {
  // Deliberately conservative. This is a budget estimate, not provider billing.
  return messages.reduce((sum, message) => sum + Buffer.byteLength(message.content, 'utf8') + 16, 128) + MAX_OUTPUT_TOKENS;
}
export function completeUsage(usage?: TokenUsage): boolean {
  return !!usage && usage.complete === true && [usage.promptTokens, usage.completionTokens, usage.totalTokens]
    .every(value => Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000)
    && usage.totalTokens >= usage.promptTokens + usage.completionTokens;
}
export function chargeFor(reserved: number, usage?: TokenUsage) {
  if (usage && completeUsage(usage)) return { charged: usage.totalTokens, source: 'reported' as const };
  const known = usage ? [usage.totalTokens, usage.promptTokens + usage.completionTokens]
    .filter(value => Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000) : [];
  return { charged: Math.max(reserved, ...known), source: 'estimated' as const };
}
