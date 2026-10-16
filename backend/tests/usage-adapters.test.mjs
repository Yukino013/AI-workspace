import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createOpenAIAdapter } from '../dist/services/ai/openai-client.js';
import { createAnthropicAdapter } from '../dist/services/ai/anthropic-client.js';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const params = { model: 'test-model', messages: [{ role: 'user', content: '测试' }], maxTokens: 4096 };
const adapters = [
  ['OpenAI', createOpenAIAdapter, data => ({ choices: [{ delta: { content: data } }] }), '[DONE]'],
  ['Anthropic', createAnthropicAdapter, data => ({ type: 'content_block_delta', delta: { type: 'text_delta', text: data } }), { type: 'message_stop' }],
];
function response(frames, { stayOpen = false, onCancel = () => {} } = {}) {
  const encoded = frames.map(frame => `data: ${typeof frame === 'string' ? frame : JSON.stringify(frame)}\r\n\r\n`).join('');
  const bytes = new TextEncoder().encode(encoded);
  return new Response(new ReadableStream({
    start(controller) {
      // 在任意字节边界分片，包含中文 UTF-8 和 CRLF。
      for (let index = 0; index < bytes.length; index += 7) controller.enqueue(bytes.slice(index, index + 7));
      if (!stayOpen) controller.close();
    },
    cancel: onCancel,
  }));
}
async function collect(adapter) {
  const events = [];
  for await (const event of adapter.stream(params, new AbortController().signal)) events.push(event);
  return events;
}
for (const [name, create, delta, end] of adapters) {
  const adapter = create(name, { apiKey: 'test', baseUrl: 'http://unused.test' });
  test(`${name} 断流不能标记成功`, async () => {
    globalThis.fetch = async () => response([delta('已生成部分内容')]);
    await assert.rejects(() => collect(adapter), /响应意外中断/);
  });
  test(`${name} 正常结束与消费者取消均释放流读取器`, async () => {
    let cancelled = 0;
    globalThis.fetch = async () => response([delta('你好'), end], { stayOpen: true, onCancel: () => { cancelled++; } });
    const events = await collect(adapter);
    assert.deepEqual(events[0], { type: 'delta', content: '你好' });
    assert.equal(events.at(-1).type, 'done');
    assert.equal(events.at(-1).usage.complete, false, '缺少用量不能被视为零消耗');
    assert.equal(cancelled, 1);
    globalThis.fetch = async () => response([delta('取消测试')], { stayOpen: true, onCancel: () => { cancelled++; } });
    for await (const _ of adapter.stream(params, new AbortController().signal)) break;
    assert.equal(cancelled, 2);
  });
  test(`${name} 上游原始错误不透传敏感信息`, async () => {
    const secret = 'credential-or-private-prompt';
    globalThis.fetch = async () => new Response(secret, { status: 401 });
    await assert.rejects(() => adapter.chat(params), error => error.message.includes('HTTP 401') && !error.message.includes(secret));
    await assert.rejects(() => collect(adapter), error => error.message.includes('HTTP 401') && !error.message.includes(secret));
    globalThis.fetch = async () => response([{ type: 'error', error: { message: secret } }, end]);
    await assert.rejects(() => collect(adapter), error => !error.message.includes(secret));
  });
}
test('Anthropic 输入含缓存用量，最终输出以 message_delta 为准', async () => {
  const adapter = createAnthropicAdapter('Anthropic', { apiKey: 'test', baseUrl: 'http://unused.test' });
  globalThis.fetch = async () => response([
    { type: 'message_start', message: { usage: { input_tokens: 10, cache_read_input_tokens: 20, cache_creation_input_tokens: 30 } } },
    { type: 'message_delta', usage: { output_tokens: 5 } },
    { type: 'message_stop' },
  ]);
  const events = await collect(adapter);
  assert.deepEqual(events.at(-1).usage, { promptTokens: 60, completionTokens: 5, totalTokens: 65, complete: true });
});
