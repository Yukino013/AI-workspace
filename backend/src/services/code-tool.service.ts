import { CodeToolRecord } from "../models/code-tool-record.model.js";
import { AIService } from "./ai/ai.service.js";
import { getApiKeyForModel } from "./provider.service.js";
import {
  CODE_TOOL_PROMPTS,
  CODE_TOOLS,
  type CodeToolKey,
} from "../constants/code-tools.js";
import { AppError } from "../utils/AppError.js";

function getTool(key: string) {
  const tool = CODE_TOOLS.find((item) => item.key === key);
  if (!tool) throw new AppError(404, 40401, "代码工具不存在");
  return tool;
}
function dto(doc: any) {
  return {
    id: String(doc._id),
    toolKey: doc.toolKey,
    title: doc.title,
    model: doc.model,
    input: doc.input,
    output: doc.output,
    language: doc.language,
    duration: doc.duration,
    tokenUsage: doc.tokenUsage,
    status: doc.status,
    errorMessage: doc.errorMessage,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}
export function listTools() {
  return CODE_TOOLS;
}
export async function prepareTool(userId: string, key: string, input: { model: string; code: string; language?: string }, operationKey?: string) {
  const tool = getTool(key);
  const messages = [
    {
      role: "system" as const,
      content:
        CODE_TOOL_PROMPTS[tool.key as CodeToolKey] +
        (input.language?.trim()
          ? `\n目标编程语言：${input.language.trim()}`
          : ""),
    },
    { role: "user" as const, content: input.code },
  ];
  const params = { model: input.model, messages, apiKey: await getApiKeyForModel(userId, input.model) };
  const context = { userId, source: "code_tool" as const, sourceRef: key, model: input.model, operationKey };
  return { tool, params, context, ticket: await AIService.prepare(params, context) };
}
export async function runTool(
  userId: string,
  key: string,
  input: { model: string; code: string; language?: string },
  operationKey?: string,
) {
  const { tool, params, context, ticket } = await prepareTool(userId, key, input, operationKey);
  const start = Date.now();

  try {
    const result = await AIService.chat(params, context, ticket);
    const record = await CodeToolRecord.create({
      userId,
      toolKey: key,
      title: `${tool.name} · ${input.code.split("\n")[0].slice(0, 40)}`,
      model: input.model,
      input: input.code,
      output: result.content,
      language: input.language ?? "",
      duration: Date.now() - start,
      tokenUsage: result.usage,
      status: "success",
    });
    return dto(record);
  } catch (err) {
    await CodeToolRecord.create({
      userId,
      toolKey: key,
      title: tool.name,
      model: input.model,
      input: input.code,
      output: "",
      language: input.language ?? "",
      duration: Date.now() - start,
      status: "error",
      errorMessage: err instanceof Error ? err.message : "AI 调用失败",
    });
    throw err;
  }
}
export async function streamTool(
  userId: string,
  key: string,
  input: { model: string; code: string; language?: string },
  onEvent: (event: { type: "reasoning" | "delta"; content: string }) => void,
  signal: AbortSignal,
  prepared?: Awaited<ReturnType<typeof prepareTool>>,
) {
  const { tool, params, context, ticket } = prepared ?? await prepareTool(userId, key, input);
  const start = Date.now();
  let output = "";
  let usage;

  try {
    for await (const event of AIService.stream(
      params, signal, context, ticket,
    )) {
      if (event.type === "delta") {
        output += event.content;
        onEvent(event);
      } else if (event.type === "reasoning") {
        onEvent(event);
      } else if (event.type === "done") {
        usage = event.usage;
      }
    }
    await CodeToolRecord.create({
      userId,
      toolKey: key,
      title: `${tool.name} · ${input.code.split("\n")[0].slice(0, 40)}`,
      model: input.model,
      input: input.code,
      output,
      language: input.language ?? "",
      duration: Date.now() - start,
      tokenUsage: usage,
      status: signal.aborted ? "aborted" : "success",
    });
  } catch (err) {
    if (!signal.aborted)
      await CodeToolRecord.create({
        userId,
        toolKey: key,
        title: tool.name,
        model: input.model,
        input: input.code,
        output,
        language: input.language ?? "",
        duration: Date.now() - start,
        status: "error",
        errorMessage: err instanceof Error ? err.message : "AI 调用失败",
      });
    if (!signal.aborted) throw err;
  }
}
