import type { Request, Response } from 'express';
import { listProviders, saveProviders } from '../services/provider.service.js';
import { ok } from '../utils/response.js';

export async function providers(req: Request, res: Response) {
  res.json(ok(await listProviders(req.user!.userId)));
}

export async function updateProviders(req: Request, res: Response) {
  res.json(ok(await saveProviders(req.user!.userId, req.body)));
}
