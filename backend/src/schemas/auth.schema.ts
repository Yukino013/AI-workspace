import { z } from 'zod';

/** 注册：严格校验，见设计文档 11.1 */
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, '用户名至少 3 个字符')
    .max(20, '用户名最多 20 个字符')
    .regex(/^[a-zA-Z0-9_]+$/, '用户名只能包含字母、数字、下划线'),
  password: z.string().min(6, '密码至少 6 位').max(50, '密码最多 50 位'),
});

/** 登录：只要求非空，错误信息交给业务逻辑去区分 */
export const loginSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
});

/** 更新昵称：允许为空（表示清除昵称），最多 30 字符 */
export const updateProfileSchema = z.object({
  nickname: z.string().trim().max(30, '昵称最多 30 个字符'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
