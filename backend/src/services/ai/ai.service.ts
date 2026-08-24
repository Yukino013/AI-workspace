import { AppError } from "../../utils/AppError.js";
import { deepseekAdapter } from "./deepseek.adapter.js";
import { qwenAdapter } from "./qwen.adapter.js";
import { anthropicAdapter } from "./anthropic.adapter.js";
import type { AIAdapter, ChatParams, ChatResult, StreamEvent } from "./openai-client.js";

/** 模型标识统一为常量，禁止业务代码写死字符串。见设计文档 7.4 */
export const AI_MODELS = {
  DEEPSEEK: "deepseek-v4-flash",
  QWEN: "qwen-plus",
  ANTHROPIC: "claude-sonnet-5",
} as const;

/** 注册表：新增模型 = 新增 Adapter + 在这里加一行，业务代码零改动 */
const adapters: Record<string, AIAdapter> = {
  [AI_MODELS.DEEPSEEK]: deepseekAdapter,
  [AI_MODELS.QWEN]: qwenAdapter,
  [AI_MODELS.ANTHROPIC]: anthropicAdapter,
};

function getAdapter(model: string): AIAdapter {
  const adapter = adapters[model];
  if (!adapter) {
    throw new AppError(400, 40001, `不支持的模型：${model}`);
  }
  return adapter;
}

/**
 * 业务层只依赖 AIService，不直接依赖具体 Adapter。
 * OpenAI 兼容协议（DeepSeek/Qwen）与 Anthropic 原生协议对业务层完全透明。
 */
export const AIService = {
  chat(params: ChatParams): Promise<ChatResult> {
    return getAdapter(params.model).chat(params);
  },

  stream(params: ChatParams, signal: AbortSignal): AsyncGenerator<StreamEvent> {
    return getAdapter(params.model).stream(params, signal);
  },
};
