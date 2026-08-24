import { z } from "zod";

// 创建 Prompt 校验
export const createPromptSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称不能超过 100 字"),
  description: z.string().max(500, "描述不能超过 500 字").optional(),
  content: z.string().min(1, "内容不能为空"),
});

export type CreatePromptPayload = z.infer<typeof createPromptSchema>;

// 更新 Prompt 校验（同创建）
export const updatePromptSchema = createPromptSchema;

export type UpdatePromptPayload = z.infer<typeof updatePromptSchema>;

// 查询参数校验
export const queryPromptsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().max(100).optional(),
});

export type QueryPromptsPayload = z.infer<typeof queryPromptsSchema>;
