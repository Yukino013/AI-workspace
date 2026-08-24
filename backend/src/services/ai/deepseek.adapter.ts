import { config } from '../../config/index.js';
import { createOpenAIAdapter } from './openai-client.js';

/** DeepSeek：OpenAI 兼容接口，SSE 为标准 data: 事件流 */
export const deepseekAdapter = createOpenAIAdapter('DeepSeek', {
  apiKey: config.deepseek.apiKey,
  baseUrl: config.deepseek.baseUrl,
});
