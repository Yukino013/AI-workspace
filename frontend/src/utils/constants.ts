/** 模型标识统一用常量，禁止在业务代码里写死字符串 */
export const AI_MODELS = {
  DEEPSEEK: "deepseek-v4-flash",
  QWEN: "qwen-plus",
  ANTHROPIC: "claude-sonnet-5",
} as const;

export type AIModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];

export const MODEL_OPTIONS: Array<{ label: string; value: AIModel }> = [
  { label: "DeepSeek", value: AI_MODELS.DEEPSEEK },
  { label: "Qwen（通义千问）", value: AI_MODELS.QWEN },
  { label: "Claude（Anthropic）", value: AI_MODELS.ANTHROPIC },
];
