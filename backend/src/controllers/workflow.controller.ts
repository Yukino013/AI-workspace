import type { Request, Response } from "express";
import {
  createWorkflowRun,
  deleteWorkflow,
  executeWorkflowRun,
  getWorkflow,
  getWorkflowRun,
  listWorkflowRuns,
  listWorkflows,
  retryWorkflowRun,
  saveWorkflow,
} from "../services/workflow.service.js";
import { ok } from "../utils/response.js";

export async function list(_req: Request, res: Response) {
  res.json(ok(await listWorkflows(_req.user!.userId)));
}

export async function getOne(req: Request, res: Response) {
  res.json(ok(await getWorkflow(req.user!.userId, String(req.params.id))));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(ok(await saveWorkflow(req.user!.userId, req.body)));
}

export async function update(req: Request, res: Response) {
  res.json(ok(await saveWorkflow(req.user!.userId, req.body, String(req.params.id))));
}

export async function remove(req: Request, res: Response) {
  await deleteWorkflow(req.user!.userId, String(req.params.id));
  res.json(ok(null));
}

export async function runs(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 20));
  res.json(ok(await listWorkflowRuns(req.user!.userId, String(req.params.id), page, pageSize)));
}

export async function startRun(req: Request, res: Response) {
  const run = await createWorkflowRun(req.user!.userId, String(req.params.id), req.body.inputs);
  await streamRun(req, res, run.id, run);
}

export async function retryRun(req: Request, res: Response) {
  const run = await retryWorkflowRun(req.user!.userId, String(req.params.id), String(req.params.runId));
  await streamRun(req, res, run.id, run);
}

async function streamRun(req: Request, res: Response, runId: string, initialRun: Awaited<ReturnType<typeof getWorkflowRun>>) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on("close", onClose);
  const canWrite = () => !res.writableEnded && !res.destroyed;
  const write = (payload: unknown) => {
    if (canWrite()) res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
  const writeDone = () => {
    if (canWrite()) res.write("data: [DONE]\n\n");
  };
  const heartbeat = setInterval(() => {
    if (canWrite()) res.write(": keep-alive\n\n");
  }, 15_000);
  heartbeat.unref();

  try {
    write({ type: "run-start", run: initialRun });
    await executeWorkflowRun(req.user!.userId, runId, { signal: controller.signal, onEvent: write });
    if (!controller.signal.aborted) writeDone();
  } catch (error) {
    if (!controller.signal.aborted) {
      write({ error: { message: error instanceof Error ? error.message : "工作流执行失败" } });
    }
  } finally {
    clearInterval(heartbeat);
    res.off("close", onClose);
    if (canWrite()) res.end();
  }
}
