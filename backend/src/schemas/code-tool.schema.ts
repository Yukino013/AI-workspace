import { z } from 'zod';
export const codeToolSchema = z.object({ model: z.string().min(1, 'model 不能为空'), code: z.string().min(1, '代码不能为空').max(50000, '代码最多 50000 个字符'), language: z.string().max(30).optional() });
