import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { fail } from '../utils/response.js';

/** JWT 结构见 7.1：{ userId, username } */
interface JwtPayload {
  userId: string;
  username: string;
}

/**
 * 鉴权中间件：解析 Authorization: Bearer <token>，成功挂载 req.user。
 * 挂在需要登录的接口前。见设计文档 11.2
 */
export function auth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json(fail(40101, '未登录'));
  }

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch {
    return res.status(401).json(fail(40101, 'token 无效或已过期'));
  }
}
