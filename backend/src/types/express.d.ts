/** 扩展 Express 的 Request 类型，让 auth 中间件挂载的 req.user 有类型提示 */
declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; username: string };
    }
  }
}

export {};
