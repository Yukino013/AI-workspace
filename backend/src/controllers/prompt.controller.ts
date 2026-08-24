import type { Request, Response } from 'express';
import {
  createPrompt,
  deletePrompt,
  getPrompt,
  listPrompts,
  listVersions,
  restoreVersion,
  updatePrompt,
} from '../services/prompt.service.js';
import { ok } from '../utils/response.js';

/** 解析分页/搜索 query（来自前端，做保守的边界处理即可） */
function parseQuery(query: Request['query']) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const keyword = typeof query.keyword === 'string' && query.keyword.trim() ? query.keyword.trim() : undefined;
  return { page, pageSize, keyword };
}

export async function list(req: Request, res: Response) {
  const data = await listPrompts(req.user!.userId, parseQuery(req.query));
  res.json(ok(data));
}

export async function create(req: Request, res: Response) {
  const { name, description, content } = req.body;
  const data = await createPrompt(req.user!.userId, { name, description, content });
  res.status(201).json(ok(data));
}

export async function getOne(req: Request, res: Response) {
  const data = await getPrompt(req.user!.userId, String(req.params.id));
  res.json(ok(data));
}

export async function update(req: Request, res: Response) {
  const { name, description, content } = req.body;
  const data = await updatePrompt(req.user!.userId, String(req.params.id), { name, description, content });
  res.json(ok(data));
}

export async function remove(req: Request, res: Response) {
  await deletePrompt(req.user!.userId, String(req.params.id));
  res.json(ok(null));
}

export async function versions(req: Request, res: Response) {
  const data = await listVersions(req.user!.userId, String(req.params.id));
  res.json(ok(data));
}

export async function restore(req: Request, res: Response) {
  const version = Number(req.params.version);
  const data = await restoreVersion(req.user!.userId, String(req.params.id), version);
  res.json(ok(data));
}
