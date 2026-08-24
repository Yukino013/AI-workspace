import type { Request, Response } from "express";
import { getRecord, listRecords, prepareChat, runChat, streamChat, deleteRecord } from "../services/chat.service.js";
import { ok } from "../utils/response.js";

/** 非流式：一次性返回完整结果 */
export async function run(req: Request, res: Response) {
  const { promptId, model, variables } = req.body;
  const data = await runChat(req.user!.userId, { promptId, model, variables });
  res.json(ok(data));
}

/**
 * SSE 流式：预检通过后才设置 SSE 响应头。
 * - 预检失败（变量缺失 / Prompt 不存在 / 未配置 Key 等）以普通 JSON 返回，由前端 !res.ok 分支处理
 * - 流开始后的 AI 异常以 data: {"error":{...}} 事件回传
 * - 客户端断开时 abort 上游请求并停止写入
 */
export async function stream(req: Request, res: Response) {
  const { promptId, model, variables } = req.body;

  // 预检：抛出的 AppError 交给统一错误处理，以 JSON 返回
  const prepared = await prepareChat(req.user!.userId, { promptId, model, variables });

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // 告诉 Nginx 不要缓冲该响应；生产配置仍应同时设置 proxy_buffering off。
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const controller = new AbortController();
  const onClientClose = () => {
    if (!res.writableEnded) {
      controller.abort();
    }
  };
  res.on("close", onClientClose);

  const canWrite = () => !res.writableEnded && !res.destroyed;
  const write = (payload: unknown) => {
    if (canWrite()) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };
  const writeDone = () => {
    if (canWrite()) {
      // [DONE] 是 SSE 协议结束标记，不能经过 JSON.stringify。
      res.write("data: [DONE]\n\n");
    }
  };

  // 长时间没有 token 时也定期发送 SSE 注释，避免代理关闭空闲连接。
  const heartbeat = setInterval(() => {
    if (canWrite()) {
      res.write(": keep-alive\n\n");
    }
  }, 15_000);
  heartbeat.unref();

  try {
    await streamChat(req.user!.userId, prepared, model, {
      onDelta: (text) => write({ choices: [{ delta: { content: text } }] }),
      signal: controller.signal,
    });
    if (!controller.signal.aborted) {
      writeDone();
    }
  } catch (err) {
    // 流已开始后出现的异常（如上游 AI 错误未在 service 内吞掉）
    if (!controller.signal.aborted) {
      write({ error: { message: err instanceof Error ? err.message : "流式请求失败" } });
    }
  } finally {
    clearInterval(heartbeat);
    res.off("close", onClientClose);
    if (canWrite()) {
      res.end();
    }
  }
}

/** 调用历史列表（分页） */
export async function records(req: Request, res: Response) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
  const data = await listRecords(req.user!.userId, { page, pageSize });
  res.json(ok(data));
}

/** 调用历史详情 */
export async function recordDetail(req: Request, res: Response) {
  const data = await getRecord(req.user!.userId, String(req.params.id));
  res.json(ok(data));
}

export async function removeRecord(req: Request, res: Response) {
  await deleteRecord(req.user!.userId, String(req.params.id));
  res.json(ok(null));
}
