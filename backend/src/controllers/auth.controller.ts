import type { Request, Response } from "express";
import {
  login as loginService,
  me as meService,
  register as registerService,
  updateAvatar as updateAvatarService,
  updateProfile as updateProfileService,
} from "../services/auth.service.js";
import { AppError } from "../utils/AppError.js";
import { ok } from "../utils/response.js";

export async function register(req: Request, res: Response) {
  const { username, password } = req.body;
  const data = await registerService(username, password);
  res.status(201).json(ok(data));
}

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;
  const data = await loginService(username, password);
  res.json(ok(data));
}

export async function me(req: Request, res: Response) {
  // auth 中间件校验通过后会挂载 req.user
  const data = await meService(req.user!.userId);
  res.json(ok(data));
}

export async function updateProfile(req: Request, res: Response) {
  const { nickname } = req.body;
  const data = await updateProfileService(req.user!.userId, nickname);
  res.json(ok(data));
}

export async function updateAvatar(req: Request, res: Response) {
  // uploadAvatar 中间件已写入磁盘，req.file 携带文件名
  if (!req.file) {
    throw new AppError(400, 40001, '请选择要上传的图片');
  }
  const avatar = `/uploads/${req.file.filename}`;
  const data = await updateAvatarService(req.user!.userId, avatar);
  res.json(ok(data));
}
