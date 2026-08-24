import { config } from '../../config/index.js';
import { createOpenAIAdapter } from './openai-client.js';

/** 通义千问：DashScope 兼容模式，同样遵循 OpenAI 协议 */
export const qwenAdapter = createOpenAIAdapter('Qwen', {
  apiKey: config.qwen.apiKey,
  baseUrl: config.qwen.baseUrl,
});
