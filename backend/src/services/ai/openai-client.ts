import { AppError } from "../../utils/AppError.js";

/** 聊天消息：OpenAI 兼容格式的 role/content */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatResult {
  content: string;
  usage: TokenUsage;
}

/** 流式事件：增量内容或结束（携带用量） */
export type StreamEvent = { type: "delta"; content: string } | { type: "done"; usage: TokenUsage };

export interface AIAdapter {
  chat(params: ChatParams): Promise<ChatResult>;
  stream(params: ChatParams, signal: AbortSignal): AsyncGenerator<StreamEvent>;
}

interface AdapterConfig {
  apiKey: string;
  baseUrl: string;
}

/** 把 OpenAI 兼容的 usage（snake_case）映射为内部 camelCase 结构 */
function mapUsage(raw: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown } | undefined): TokenUsage {
  const promptTokens = Number(raw?.prompt_tokens ?? 0);
  const completionTokens = Number(raw?.completion_tokens ?? 0);
  return {
    promptTokens,
    completionTokens,
    totalTokens: Number(raw?.total_tokens ?? promptTokens + completionTokens),
  };
}

/** 未配置 API Key 时给出明确提示，避免把晦涩的 401 透传给用户 */
function assertKey(apiKey: string, name: string) {
  if (!apiKey) {
    throw new AppError(500, 50000, `未配置 ${name} API Key，请在 backend/.env 中填写`);
  }
}

/** 按 SSE 规范提取一个事件的 data 字段；注释/心跳事件返回 null。 */
export function getSseData(event: string): string | null {
  const dataLines: string[] = [];

  for (const line of event.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;

    const separator = line.indexOf(":");
    const field = separator === -1 ? line : line.slice(0, separator);
    if (field !== "data") continue;

    let value = separator === -1 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    dataLines.push(value);
  }

  return dataLines.length ? dataLines.join("\n") : null;
}

interface UpstreamStreamPayload {
  choices?: Array<{ delta?: { content?: string } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown };
}

function parseStreamPayload(data: string): UpstreamStreamPayload | null {
  try {
    return JSON.parse(data) as UpstreamStreamPayload;
  } catch {
    return null;
  }
}

/**
 * 创建 OpenAI 兼容适配器。DeepSeek 与 Qwen 均遵循 OpenAI 的
 * chat/completions 协议（非流式返回 choices[].message，流式返回 SSE data: 事件），
 * 因此共用同一套客户端，仅 baseUrl / apiKey / 名称不同。
 */
export function createOpenAIAdapter(name: string, cfg: AdapterConfig): AIAdapter {
  const baseUrl = cfg.baseUrl.replace(/\/$/, "");

  async function chat(params: ChatParams): Promise<ChatResult> {
    assertKey(cfg.apiKey, name);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({ model: params.model, messages: params.messages, stream: false }),
    });

    if (!res.ok) {
      throw new AppError(502, 50000, `${name} 调用失败（HTTP ${res.status}）：${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return { content, usage: mapUsage(data.usage) };
  }

  async function* stream(params: ChatParams, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    assertKey(cfg.apiKey, name);
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        stream: true,
        // OpenAI 兼容接口需要显式开启，流结束时才会返回 token 用量。
        stream_options: { include_usage: true },
      }),
      signal,
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw new AppError(502, 50000, `${name} 调用失败（HTTP ${res.status}）：${detail}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let usage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let upstreamDone = false;

    const consumeEvent = (event: string): StreamEvent[] => {
      const data = getSseData(event);
      if (data === null) return [];
      if (data === "[DONE]") {
        upstreamDone = true;
        return [];
      }

      const json = parseStreamPayload(data);
      if (!json) return [];

      const events: StreamEvent[] = [];
      const delta = json.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        events.push({ type: "delta", content: delta });
      }
      if (json.usage) {
        usage = mapUsage(json.usage);
      }
      return events;
    };

    while (!upstreamDone) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 同时兼容 LF 与 CRLF；最后一段不完整事件保留到下一次读取。
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const event of events) {
        for (const parsed of consumeEvent(event)) {
          yield parsed;
        }
        if (upstreamDone) break;
      }
    }

    // 某些兼容服务会直接关闭连接而不补最后一个空行，仍需消费流尾事件。
    buffer += decoder.decode();
    if (!upstreamDone && buffer.trim()) {
      for (const parsed of consumeEvent(buffer)) {
        yield parsed;
      }
    }

    yield { type: "done", usage };
  }

  return { chat, stream };
}
