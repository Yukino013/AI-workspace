import { Types } from "mongoose";
import { Prompt } from "../models/prompt.model.js";
import { ChatRecord } from "../models/chat-record.model.js";
import { AIService } from "./ai/ai.service.js";
import type { ChatMessage, TokenUsage } from "./ai/openai-client.js";
import { extractVariables, renderPrompt } from "../utils/variables.js";
import { AppError } from "../utils/AppError.js";

export interface ChatRunInput {
  promptId: string;
  model: string;
  variables: Record<string, string>;
}

export interface PreparedChat {
  promptId: Types.ObjectId;
  promptName: string;
  promptVersion: number;
  /** 变量替换后的完整 AI 输入 */
  input: string;
  messages: ChatMessage[];
}

export interface StreamHandlers {
  onDelta: (text: string) => void;
  signal: AbortSignal;
}

function zeroUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function toIso(v: unknown): string {
  return v ? new Date(v as string).toISOString() : "";
}

function toRecordDto(doc: {
  _id: unknown;
  promptId: unknown;
  promptName?: string;
  promptVersion: number;
  model: string;
  input: string;
  output: string;
  duration: number;
  tokenUsage?: TokenUsage;
  status: string;
  errorMessage?: string | null;
  createdAt: Date;
}) {
  return {
    id: String(doc._id),
    promptId: String(doc.promptId),
    promptName: doc.promptName ?? "",
    promptVersion: doc.promptVersion,
    model: doc.model,
    input: doc.input,
    output: doc.output,
    duration: doc.duration,
    tokenUsage: doc.tokenUsage,
    status: doc.status,
    errorMessage: doc.errorMessage ?? undefined,
    createdAt: toIso(doc.createdAt),
  };
}

/** 校验所有 {{key}} 都有值，缺一个就 40001（见 7.3） */
function validateVariables(required: string[], values: Record<string, string>) {
  const missing = required.filter((key) => !values[key]?.trim());
  if (missing.length) {
    throw new AppError(400, 40001, `参数错误：缺少变量 ${missing.join("、")}`);
  }
}

/**
 * 预检：校验资源归属 + 变量完整性 + 渲染输入。
 * 在 SSE 流开始前调用，失败时抛 AppError，由统一错误处理以 JSON 返回。
 */
export async function prepareChat(userId: string, input: ChatRunInput): Promise<PreparedChat> {
  const prompt = await Prompt.findOne({ _id: input.promptId, userId });
  if (!prompt) {
    throw new AppError(404, 40401, "Prompt 不存在");
  }

  validateVariables(extractVariables(prompt.content), input.variables);
  const rendered = renderPrompt(prompt.content, input.variables);

  return {
    promptId: prompt._id,
    promptName: prompt.name,
    promptVersion: prompt.currentVersion,
    input: rendered,
    messages: [{ role: "user", content: rendered }],
  };
}

/** 非流式：一次性返回完整结果，并落库。见设计文档 7.4 */
export async function runChat(userId: string, input: ChatRunInput) {
  const prepared = await prepareChat(userId, input);
  const start = Date.now();

  try {
    const result = await AIService.chat({ model: input.model, messages: prepared.messages });
    const record = await ChatRecord.create({
      userId,
      promptId: prepared.promptId,
      promptName: prepared.promptName,
      promptVersion: prepared.promptVersion,
      model: input.model,
      input: prepared.input,
      output: result.content,
      duration: Date.now() - start,
      tokenUsage: result.usage,
      status: "success",
    });
    return toRecordDto(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI 调用失败";
    await ChatRecord.create({
      userId,
      promptId: prepared.promptId,
      promptName: prepared.promptName,
      promptVersion: prepared.promptVersion,
      model: input.model,
      input: prepared.input,
      output: "",
      duration: Date.now() - start,
      tokenUsage: zeroUsage(),
      status: "error",
      errorMessage: message,
    });
    throw err;
  }
}

/**
 * 流式执行：转发增量 + 聚合最终输出，结束后落库。
 * 预检（归属/变量）应在上游 prepareChat 完成，这里专注转发与落库。
 */
export async function streamChat(userId: string, prepared: PreparedChat, model: string, handlers: StreamHandlers) {
  const start = Date.now();
  let output = "";
  let usage = zeroUsage();

  try {
    for await (const event of AIService.stream({ model, messages: prepared.messages }, handlers.signal)) {
      if (event.type === "delta") {
        output += event.content;
        handlers.onDelta(event.content);
      } else if (event.type === "done") {
        usage = event.usage;
      }
    }

    await ChatRecord.create({
      userId,
      promptId: prepared.promptId,
      promptName: prepared.promptName,
      promptVersion: prepared.promptVersion,
      model,
      input: prepared.input,
      output,
      duration: Date.now() - start,
      tokenUsage: usage,
      status: "success",
    });
  } catch (err) {
    const e = err as Error;
    const aborted = handlers.signal.aborted || e.name === "AbortError";
    const errorMessage = aborted ? undefined : e.message;

    await ChatRecord.create({
      userId,
      promptId: prepared.promptId,
      promptName: prepared.promptName,
      promptVersion: prepared.promptVersion,
      model,
      input: prepared.input,
      output,
      duration: Date.now() - start,
      tokenUsage: usage,
      status: aborted ? "aborted" : "error",
      errorMessage,
    });

    // 非中断错误继续向上抛，由 controller 以 data: {"error":{...}} 事件回传（见 11.4）
    if (!aborted) {
      throw new AppError(502, 50000, errorMessage ?? "AI 调用失败");
    }
  }
}

export async function listRecords(userId: string, query: { page: number; pageSize: number }) {
  const skip = (query.page - 1) * query.pageSize;
  const [docs, total] = await Promise.all([ChatRecord.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(query.pageSize), ChatRecord.countDocuments({ userId })]);
  return { items: docs.map(toRecordDto), total, page: query.page, pageSize: query.pageSize };
}

export async function getRecord(userId: string, id: string) {
  const record = await ChatRecord.findOne({ _id: id, userId });
  if (!record) {
    throw new AppError(404, 40401, "调用记录不存在");
  }
  return toRecordDto(record);
}

export async function deleteRecord(userId: string, id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(400, 40001, "无效的调用记录 ID");
  }
  const result = await ChatRecord.findOneAndDelete({ _id: id, userId });
  if (!result) {
    throw new AppError(404, 40401, "调用记录不存在");
  }
}
