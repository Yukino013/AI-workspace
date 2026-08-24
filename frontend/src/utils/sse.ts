import { useAuthStore } from '@/stores/auth';

export interface StreamPayload {
  promptId: string;
  model: string;
  variables: Record<string, string>;
}

export interface StreamHandlers {
  onChunk: (text: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

/** 按 SSE 规范提取一个事件的 data 字段；注释/心跳事件返回 null。 */
function getSseData(event: string): string | null {
  const dataLines: string[] = [];

  for (const line of event.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;

    const separator = line.indexOf(':');
    const field = separator === -1 ? line : line.slice(0, separator);
    if (field !== 'data') continue;

    let value = separator === -1 ? '' : line.slice(separator + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    dataLines.push(value);
  }

  return dataLines.length ? dataLines.join('\n') : null;
}

/**
 * 消费 POST SSE 流式输出。
 *
 * 为什么不用 EventSource：EventSource 只支持 GET，无法携带请求体和
 * Authorization 头，因此必须用 fetch + ReadableStream 手动解析。
 *
 * SSE 事件以空行分隔，数据行以 "data:" 开头，结束标记为 "data: [DONE]"
 * （OpenAI 兼容格式，DeepSeek / Qwen 均遵循）。
 *
 * 返回 AbortController，调用 .abort() 可停止生成。
 */
export function streamChat(payload: StreamPayload, handlers: StreamHandlers): AbortController {
  const controller = new AbortController();
  const auth = useAuthStore();

  void (async () => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let terminalCallbackCalled = false;

    const notifyDone = () => {
      if (terminalCallbackCalled) return;
      terminalCallbackCalled = true;
      handlers.onDone?.();
    };

    const notifyError = (error: Error) => {
      if (terminalCallbackCalled) return;
      terminalCallbackCalled = true;
      handlers.onError?.(error);
    };

    const consumeEvent = (event: string): boolean => {
      const data = getSseData(event);
      if (data === null) return false;
      if (data === '[DONE]') return true;

      let json: { error?: { message?: string }; choices?: Array<{ delta?: { content?: string } }> };
      try {
        json = JSON.parse(data);
      } catch {
        throw new Error('服务器返回了无法解析的 SSE 数据');
      }

      if (json.error?.message) {
        throw new Error(json.error.message);
      }

      const delta = json.choices?.[0]?.delta?.content ?? '';
      if (delta) handlers.onChunk(delta);
      return false;
    };

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `请求失败（HTTP ${res.status}）`);
      }
      if (!res.body) {
        throw new Error('浏览器未收到可读取的响应流');
      }

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        throw new Error('服务器未返回 SSE 响应');
      }

      reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 同时兼容 LF 与 CRLF；最后一段不完整事件保留到下一次读取。
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() ?? '';

        for (const event of events) {
          if (consumeEvent(event)) {
            await reader.cancel();
            notifyDone();
            return;
          }
        }
      }

      // 流关闭前没有空行时，处理最后一个残留事件。
      buffer += decoder.decode();
      if (buffer.trim()) {
        consumeEvent(buffer);
      }
      notifyDone();
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        notifyDone();
        return;
      }
      controller.abort();
      notifyError(err as Error);
    } finally {
      reader?.releaseLock();
    }
  })();

  return controller;
}
