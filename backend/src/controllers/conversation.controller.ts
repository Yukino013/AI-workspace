import type { Request, Response } from 'express';
import { createConversation, deleteConversation, getConversation, listConversations, runMessage, streamMessage, updateConversation } from '../services/conversation.service.js';
import { ok } from '../utils/response.js';

export async function list(req: Request, res: Response) { res.json(ok(await listConversations(req.user!.userId))); }
export async function create(req: Request, res: Response) { res.status(201).json(ok(await createConversation(req.user!.userId, req.body.model))); }
export async function detail(req: Request, res: Response) { res.json(ok(await getConversation(req.user!.userId, String(req.params.id)))); }
export async function update(req: Request, res: Response) { res.json(ok(await updateConversation(req.user!.userId, String(req.params.id), req.body.model))); }
export async function remove(req: Request, res: Response) { await deleteConversation(req.user!.userId, String(req.params.id)); res.json(ok(null)); }
export async function message(req: Request, res: Response) { res.json(ok(await runMessage(req.user!.userId, String(req.params.id), req.body.content))); }
export async function stream(req: Request, res: Response) {
  const controller = new AbortController(); res.status(200).set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.flushHeaders?.();
  const close = () => { if (!res.writableEnded) controller.abort(); }; res.on('close', close);
  const write = (v: unknown) => { if (!res.writableEnded && !res.destroyed) res.write(`data: ${JSON.stringify(v)}\n\n`); };
  try { await streamMessage(req.user!.userId, String(req.params.id), req.body.content, (text) => write({ choices: [{ delta: { content: text } }] }), controller.signal); if (!controller.signal.aborted) res.write('data: [DONE]\n\n'); } catch (err) { if (!controller.signal.aborted) write({ error: { message: err instanceof Error ? err.message : '流式请求失败' } }); } finally { res.off('close', close); if (!res.writableEnded) res.end(); }
}
