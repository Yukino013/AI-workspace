import { config } from '../../config/index.js';
import { createAnthropicAdapter } from './anthropic-client.js';

/** Anthropic（Claude）：原生 Messages API，协议与 OpenAI 兼容接口不同 */
export const anthropicAdapter = createAnthropicAdapter('Anthropic', {
  apiKey: config.anthropic.apiKey,
  baseUrl: config.anthropic.baseUrl,
});
