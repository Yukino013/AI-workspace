import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { fail } from '../utils/response.js';

/** 兜底 404 */
export function notFound(_req: Request, res: Response) {
  res.status(404).json(fail(40401, '资源不存在'));
}

/**
 * 统一错误处理：见设计文档 11.3
 * - 业务错误（AppError）按 status/code/message 返回
 * - 未知错误一律 50000，不把堆栈暴露给前端
 * - Express 5 会自动把 async handler 抛出的错误转发到这里
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.status).json(fail(err.code, err.message));
  }
  // multer 文件上传错误（如超限），转换成友好提示，不落到 50000
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? '头像不能超过 2MB' : '文件上传失败';
    return res.status(400).json(fail(40001, message));
  }
  console.error(err); // 服务端日志
  res.status(500).json(fail(50000, '服务器内部错误'));
}
