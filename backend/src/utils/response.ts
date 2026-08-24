/** 统一响应格式 { code, message, data }。见设计文档第 9 章 */
export const ok = (data: unknown) => ({ code: 0, message: 'ok', data });

export const fail = (code: number, message: string) => ({
  code,
  message,
  data: null,
});
