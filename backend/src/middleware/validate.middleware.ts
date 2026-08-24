import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { fail } from "../utils/response.js";

/**
 * 通用参数校验中间件：safeParse 失败返回 40001，
 * 并把具体哪一栏不合法拼进 message，方便前端提示。
 */
export function validate(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const msg = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return res.status(400).json(fail(40001, msg));
    }
    req.body = result.data;
    next();
  };
}
