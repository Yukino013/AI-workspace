import { AppError } from '../../utils/AppError.js';
import { getSseData } from './openai-client.js';
import type {
  AIAdapter,
  ChatMessage,
  ChatParams,
  ChatResult,
  StreamEvent,
  TokenUsage,
} from './openai-client.js';

interface AdapterConfig {
  apiKey: string;
  baseUrl: string;
}

/** Anthropic Messages API 版本头，必须携带 */
const ANTHROPIC_VERSION = '2023-06-01';

/** 未配置 API Key 时给出明确提示，避免把晦涩的 401 透传给用户 */
function assertKey(apiKey: string, name: string) {
  if (!apiKey) {
    throw new AppError(500, 50000, `未配置 ${name} API Key，请在 Provider 配置中填写，或在 backend/.env 中配置`);
  }
}

/**
 * 把 OpenAI 风格的 messages 转成 Anthropic Messages API 格式：
 * - Anthropic 没有 system role，system 消息抽到顶层 `system` 字段
 * - 首条必须是 user，且 user/assistant 严格交替（Anthropic 硬性要求，连发同角色会报错）
 */
function toAnthropicMessages(messages: ChatMessage[]) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n');

  let list: Array<{ role: 'user' | 'assistant'; content: string }> = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  // 首条必须是 user：若以 assistant 开头，前置一个占位 user 消息
  if (list.length && list[0].role !== 'user') {
    list = [{ role: 'user', content: '(continue)' }, ...list];
  }
  if (!list.length) {
    list = [{ role: 'user', content: '(empty)' }];
  }

  // 保证严格交替：连续同角色时插入占位消息
  const normalized: typeof list = [];
  for (const msg of list) {
    const prev = normalized[normalized.length - 1];
    if (prev && prev.role === msg.role) {
      normalized.push({
        role: prev.role === 'user' ? 'assistant' : 'user',
        content: '(continue)',
      });
    }
    normalized.push(msg);
  }

  return { system, messages: normalized };
}

function toUsage(input: number, output: number, complete = false): TokenUsage {
  return { promptTokens: input, completionTokens: output, totalTokens: input + output, complete };
}

interface AnthropicUsage {
  input_tokens?: unknown;
  output_tokens?: unknown;
  cache_creation_input_tokens?: unknown;
  cache_read_input_tokens?: unknown;
}

/**
 * Anthropic 的 `input_tokens` 只统计未命中缓存的输入，缓存写入与缓存读取的 Token
 * 由独立字段上报。只累加前者会低估用量，因此这里把它们一起算作输入；
 * 缺失的缓存字段按 0 处理，但只有 `input_tokens` 明确存在才算“已知输入”。
 */
function readInputTokens(usage: AnthropicUsage | undefined) {
  if (!Number.isSafeInteger(usage?.input_tokens)) return { tokens: 0, complete: false };
  const cache = [usage!.cache_creation_input_tokens, usage!.cache_read_input_tokens]
    .reduce<number>((sum, value) => sum + (Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0), 0);
  return { tokens: Number(usage!.input_tokens) + cache, complete: true };
}

function readOutputTokens(usage: AnthropicUsage | undefined) {
  return Number.isSafeInteger(usage?.output_tokens) ? Number(usage!.output_tokens) : 0;
}

/** 提取非流式响应中的纯文本（content 是 block 数组） */
function extractText(data: {
  content?: Array<{ type?: string; text?: string }>;
}): string {
  return (data.content ?? [])
    .map((block) => (block.type === 'text' ? block.text ?? '' : ''))
    .join('');
}

/**
 * 创建 Anthropic 适配器。与 OpenAI 兼容接口不同，Anthropic 走原生
 * Messages API：`x-api-key` 头、system 顶层字段、事件式 SSE
 * （message_start / content_block_delta / message_delta / message_stop）。
 * 对外仍实现同一个 AIAdapter 接口，业务层无需感知差异。
 */
export function createAnthropicAdapter(name: string, cfg: AdapterConfig): AIAdapter {
  const baseUrl = cfg.baseUrl.replace(/\/$/, '');

  async function chat(params: ChatParams): Promise<ChatResult> {
    const apiKey = params.apiKey ?? cfg.apiKey;
    assertKey(apiKey, name);
    const { system, messages } = toAnthropicMessages(params.messages);
    const body: Record<string, unknown> = { model: params.model, max_tokens: params.maxTokens ?? 4096, messages };
    if (system) body.system = system;

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: params.signal,
    });

    if (!res.ok) {
      throw new AppError(502, 50000, `${name} 调用失败（HTTP ${res.status}）：${await res.text()}`);
    }

    const data = await res.json();
    const input = readInputTokens(data.usage);
    return {
      content: extractText(data),
      usage: toUsage(input.tokens, readOutputTokens(data.usage), input.complete && Number.isSafeInteger(data.usage?.output_tokens)),
    };
  }

  async function* stream(params: ChatParams, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    const apiKey = params.apiKey ?? cfg.apiKey;
    assertKey(apiKey, name);
    const { system, messages } = toAnthropicMessages(params.messages);
    const body: Record<string, unknown> = {
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      messages,
      stream: true,
    };
    if (system) body.system = system;

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => '');
      throw new AppError(502, 50000, `${name} 调用失败（HTTP ${res.status}）：${detail}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: TokenUsage = toUsage(0, 0);
    let messageStopped = false;
    let hasInput = false;
    let hasOutput = false;

    // Anthropic 的事件通过 data 里的 type 字段区分，命名事件行（event:）可忽略
    const consumeEvent = (event: string): StreamEvent[] => {
      const data = getSseData(event);
      if (data === null) return [];

      let json: {
        type?: string;
        delta?: { type?: string; text?: string; thinking?: string };
        usage?: unknown;
        message?: { usage?: unknown };
      };
      try {
        json = JSON.parse(data) as typeof json;
      } catch {
        return [];
      }

      const events: StreamEvent[] = [];
      switch (json.type) {
        case 'message_start': {
          const input = readInputTokens(json.message?.usage as AnthropicUsage | undefined);
          hasInput = input.complete;
          usage = toUsage(input.tokens, 0);
          break;
        }
        case 'content_block_delta':
          if (json.delta?.type === 'thinking_delta' && json.delta.thinking) {
            events.push({ type: 'reasoning', content: json.delta.thinking });
          } else if (json.delta?.type === 'text_delta' && json.delta.text) {
            events.push({ type: 'delta', content: json.delta.text });
          }
          break;
        case 'message_delta': {
          hasOutput = Number.isSafeInteger((json.usage as AnthropicUsage | undefined)?.output_tokens);
          usage = toUsage(usage.promptTokens, readOutputTokens(json.usage as AnthropicUsage | undefined));
          break;
        }
        case 'message_stop':
          // 流结束标记，循环据此退出，统一在最后 yield done，避免重复
          messageStopped = true;
          break;
        default:
          // ping / content_block_start / content_block_stop 等无需处理
          break;
      }
      return events;
    };

    while (!messageStopped) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 事件以空行分隔，最后一段不完整事件保留到下一次读取
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? '';

      for (const event of events) {
        for (const parsed of consumeEvent(event)) {
          yield parsed;
        }
        if (messageStopped) break;
      }
    }

    // 某些网关会直接关闭连接而不补最后一个空行，仍需消费流尾事件
    buffer += decoder.decode();
    if (!messageStopped && buffer.trim()) {
      for (const parsed of consumeEvent(buffer)) {
        yield parsed;
      }
    }

    yield { type: 'done', usage: { ...usage, complete: messageStopped && hasInput && hasOutput } };
  }

  return { chat, stream };
}
