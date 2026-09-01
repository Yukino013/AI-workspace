import { z } from 'zod';

export const createConversationSchema = z.object({ model: z.string().min(1, 'model 不能为空') });
export const messageSchema = z.object({ content: z.string().trim().min(1, '消息不能为空').max(20000, '消息最多 20000 个字符') });
export type MessagePayload = z.infer<typeof messageSchema>;
