import { z } from 'zod';

export const providerSchema = z.object({
  deepseek: z.string().max(500).optional(),
  qwen: z.string().max(500).optional(),
  anthropic: z.string().max(500).optional(),
}).refine((value) => Object.keys(value).length > 0, '至少提供一个 Provider 配置');

export type ProviderPayload = z.infer<typeof providerSchema>;
