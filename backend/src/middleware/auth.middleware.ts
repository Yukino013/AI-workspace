import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { config } from "../config/index.js";
import { User } from "../models/user.model.js";
import { fail } from "../utils/response.js";

/** 每次请求均查询当前账号版本，撤销后发起的请求不会继续使用旧凭证。 */
export async function auth(req: Request, res: Response, next: NextFunction) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.headers.authorization ?? "");
  if (!match) return res.status(401).json(fail(40101, "未登录"));

  let payload;
  try {
    payload = jwt.verify(match[1], config.jwt.secret, { algorithms: ["HS256"] });
  } catch {
    return res.status(401).json(fail(40101, "token 无效或已过期"));
  }

  // 不兼容缺少版本号的旧 JWT：升级后需要重新登录，不能把缺失值当成 0。
  if (
    typeof payload !== "object" ||
    typeof payload.userId !== "string" || !isValidObjectId(payload.userId) ||
    typeof payload.username !== "string" ||
    !Number.isSafeInteger(payload.tokenVersion) || payload.tokenVersion < 0 ||
    typeof payload.exp !== "number"
  ) {
    return res.status(401).json(fail(40101, "token 无效，请重新登录"));
  }

  try {
    const user = await User.findById(payload.userId).select("username tokenVersion");
    // 历史用户文档没有此字段时按 0 处理；下一次退出会原子创建并递增该字段。
    if (!user || (user.tokenVersion ?? 0) !== payload.tokenVersion) {
      return res.status(401).json(fail(40101, "登录已失效，请重新登录"));
    }
    req.user = { userId: String(user._id), username: user.username, tokenVersion: payload.tokenVersion };
  } catch (err) {
    // 数据库异常交给统一错误处理，不能伪装成 401 导致客户端误清登录状态。
    return next(err);
  }
  next();
}
