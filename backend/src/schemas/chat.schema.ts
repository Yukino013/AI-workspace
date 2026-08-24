import { z } from 'zod';

/** 调用 AI 的入参校验（非流式 / 流式共用）。见设计文档 7.5 */
export const chatSchema = z.object({
  promptId: z.string().min(1, 'promptId 不能为空'),
  model: z.string().min(1, 'model 不能为空'),
  variables: z.record(z.string(), z.string()).default({}),
});

export type ChatPayload = z.infer<typeof chatSchema>;
