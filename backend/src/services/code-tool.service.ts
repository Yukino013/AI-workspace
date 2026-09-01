import { CodeToolRecord } from '../models/code-tool-record.model.js';
import { AIService } from './ai/ai.service.js';
import { getApiKeyForModel } from './provider.service.js';
import { CODE_TOOL_PROMPTS, CODE_TOOLS, type CodeToolKey } from '../constants/code-tools.js';
import { AppError } from '../utils/AppError.js';

function getTool(key: string) { const tool = CODE_TOOLS.find((item) => item.key === key); if (!tool) throw new AppError(404, 40401, '代码工具不存在'); return tool; }
function dto(doc: any) { return { id: String(doc._id), toolKey: doc.toolKey, title: doc.title, model: doc.model, input: doc.input, output: doc.output, language: doc.language, duration: doc.duration, tokenUsage: doc.tokenUsage, status: doc.status, errorMessage: doc.errorMessage, createdAt: new Date(doc.createdAt).toISOString() }; }
export function listTools() { return CODE_TOOLS; }
export async function runTool(userId: string, key: string, input: { model: string; code: string; language?: string }) {
  const tool = getTool(key); const start = Date.now(); const messages = [{ role: 'system' as const, content: CODE_TOOL_PROMPTS[tool.key as CodeToolKey] }, { role: 'user' as const, content: input.code }];
  try { const result = await AIService.chat({ model: input.model, messages, apiKey: await getApiKeyForModel(userId, input.model) }); const record = await CodeToolRecord.create({ userId, toolKey: key, title: `${tool.name} · ${input.code.split('\n')[0].slice(0, 40)}`, model: input.model, input: input.code, output: result.content, language: input.language ?? '', duration: Date.now() - start, tokenUsage: result.usage, status: 'success' }); return dto(record); } catch (err) { await CodeToolRecord.create({ userId, toolKey: key, title: tool.name, model: input.model, input: input.code, output: '', language: input.language ?? '', duration: Date.now() - start, status: 'error', errorMessage: err instanceof Error ? err.message : 'AI 调用失败' }); throw err; }
}
export async function streamTool(userId: string, key: string, input: { model: string; code: string; language?: string }, onDelta: (text: string) => void, signal: AbortSignal) {
  const tool = getTool(key); const start = Date.now(); let output = ''; let usage; const messages = [{ role: 'system' as const, content: CODE_TOOL_PROMPTS[tool.key as CodeToolKey] }, { role: 'user' as const, content: input.code }];
  try { for await (const event of AIService.stream({ model: input.model, messages, apiKey: await getApiKeyForModel(userId, input.model) }, signal)) { if (event.type === 'delta') { output += event.content; onDelta(event.content); } else usage = event.usage; } await CodeToolRecord.create({ userId, toolKey: key, title: `${tool.name} · ${input.code.split('\n')[0].slice(0, 40)}`, model: input.model, input: input.code, output, language: input.language ?? '', duration: Date.now() - start, tokenUsage: usage, status: signal.aborted ? 'aborted' : 'success' }); } catch (err) { if (!signal.aborted) await CodeToolRecord.create({ userId, toolKey: key, title: tool.name, model: input.model, input: input.code, output, language: input.language ?? '', duration: Date.now() - start, status: 'error', errorMessage: err instanceof Error ? err.message : 'AI 调用失败' }); if (!signal.aborted) throw err; }
}
