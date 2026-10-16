import mongoose from "mongoose";
import { Prompt } from "../models/prompt.model.js";
import { Workflow } from "../models/workflow.model.js";
import { WorkflowRun } from "../models/workflow-run.model.js";
import { AI_MODELS, AIService } from "./ai/ai.service.js";
import type { TokenUsage } from "./ai/openai-client.js";
import { getApiKeyForModel } from "./provider.service.js";
import { AppError } from "../utils/AppError.js";
import { extractVariables, renderPrompt } from "../utils/variables.js";
import { getWorkflowInputKeys, resolveStepVariables, validateWorkflowBindings } from "./workflow-utils.js";

const supportedModels = new Set<string>(Object.values(AI_MODELS));
const emptyUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

type InputStep = { id: string; promptId: string; model: string; bindings: Record<string, string> };
type InputWorkflow = { name: string; description?: string; steps: InputStep[] };

function toRecord(value: unknown): Record<string, string> {
  if (value instanceof Map) return Object.fromEntries(value.entries());
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  }
  return {};
}

function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : "";
}

function toWorkflowDto(doc: {
  _id: unknown;
  name: string;
  description?: string;
  version: number;
  steps: Array<{
    id: string;
    promptId: unknown;
    promptName: string;
    promptVersion: number;
    promptContent: string;
    variables: string[];
    model: string;
    bindings: Map<string, string> | Record<string, string>;
  }>;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: String(doc._id),
    name: doc.name,
    description: doc.description ?? "",
    version: doc.version,
    steps: doc.steps.map((step) => ({
      id: step.id,
      promptId: String(step.promptId),
      promptName: step.promptName,
      promptVersion: step.promptVersion,
      promptContent: step.promptContent,
      variables: step.variables ?? [],
      model: step.model,
      bindings: toRecord(step.bindings),
    })),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function toRunDto(doc: {
  _id: unknown;
  workflowId: unknown;
  workflowName: string;
  workflowVersion: number;
  retryOfRunId?: unknown;
  inputs: Map<string, string> | Record<string, string>;
  status: string;
  steps: Array<{
    stepId: string;
    promptName: string;
    promptVersion: number;
    model: string;
    input: string;
    output: string;
    status: string;
    duration: number;
    tokenUsage?: TokenUsage;
    errorMessage?: string;
  }>;
  startedAt: Date;
  finishedAt?: Date | null;
  createdAt: Date;
}) {
  return {
    id: String(doc._id),
    workflowId: String(doc.workflowId),
    workflowName: doc.workflowName,
    workflowVersion: doc.workflowVersion,
    retryOfRunId: doc.retryOfRunId ? String(doc.retryOfRunId) : undefined,
    inputs: toRecord(doc.inputs),
    status: doc.status,
    steps: doc.steps.map((step) => ({
      stepId: step.stepId,
      promptName: step.promptName,
      promptVersion: step.promptVersion,
      model: step.model,
      input: step.input,
      output: step.output,
      status: step.status,
      duration: step.duration,
      tokenUsage: step.tokenUsage ?? emptyUsage,
      errorMessage: step.errorMessage || undefined,
    })),
    startedAt: toIso(doc.startedAt),
    finishedAt: toIso(doc.finishedAt),
    createdAt: toIso(doc.createdAt),
  };
}

async function findWorkflow(userId: string, id: string) {
  if (!mongoose.isValidObjectId(id)) throw new AppError(404, 40401, "工作流不存在");
  const workflow = await Workflow.findOne({ _id: id, userId });
  if (!workflow) throw new AppError(404, 40401, "工作流不存在");
  return workflow;
}

function normalizedBindings(bindings: Map<string, string> | Record<string, string>) {
  return toRecord(bindings);
}

async function snapshotSteps(userId: string, steps: InputStep[]) {
  const ids = new Set<string>();
  for (const [index, step] of steps.entries()) {
    if (ids.has(step.id)) throw new AppError(400, 40001, `第 ${index + 1} 个步骤 ID 重复`);
    ids.add(step.id);
    if (!supportedModels.has(step.model)) throw new AppError(400, 40001, `不支持的模型：${step.model}`);
  }
  const promptIds = [...new Set(steps.map((step) => step.promptId))];
  if (promptIds.some((id) => !mongoose.isValidObjectId(id))) {
    throw new AppError(404, 40401, "Prompt 不存在");
  }
  const prompts = await Prompt.find({ _id: { $in: promptIds }, userId });
  const promptById = new Map(prompts.map((prompt) => [String(prompt._id), prompt]));

  const snapshots = steps.map((step, index) => {
    const prompt = promptById.get(step.promptId);
    if (!prompt) throw new AppError(404, 40401, `第 ${index + 1} 个步骤引用的 Prompt 不存在`);
    const variables = extractVariables(prompt.content);
    const extraBindings = Object.keys(step.bindings).filter((variable) => !variables.includes(variable));
    if (extraBindings.length) {
      throw new AppError(400, 40001, `第 ${index + 1} 步包含无效变量映射：${extraBindings.join("、")}`);
    }
    validateWorkflowBindings(
      steps.slice(0, index + 1).map((prior) => {
        const priorPrompt = promptById.get(prior.promptId);
        return { id: prior.id, variables: priorPrompt ? extractVariables(priorPrompt.content) : [], bindings: prior.bindings };
      }),
    );
    return {
      id: step.id,
      promptId: prompt._id,
      promptName: prompt.name,
      promptVersion: prompt.currentVersion,
      promptContent: prompt.content,
      variables,
      model: step.model,
      bindings: step.bindings,
    };
  });
  return snapshots;
}

export async function listWorkflows(userId: string) {
  const docs = await Workflow.find({ userId }).sort({ updatedAt: -1 }).limit(100);
  return docs.map(toWorkflowDto);
}

export async function getWorkflow(userId: string, id: string) {
  return toWorkflowDto(await findWorkflow(userId, id));
}

export async function saveWorkflow(userId: string, input: InputWorkflow, id?: string) {
  const steps = await snapshotSteps(userId, input.steps);
  if (!id) {
    const workflow = await Workflow.create({
      userId,
      name: input.name,
      description: input.description ?? "",
      version: 1,
      steps,
    });
    return toWorkflowDto(workflow);
  }

  const workflow = await findWorkflow(userId, id);
  workflow.name = input.name;
  workflow.description = input.description ?? "";
  workflow.set("steps", steps);
  workflow.version += 1;
  await workflow.save();
  return toWorkflowDto(workflow);
}

export async function deleteWorkflow(userId: string, id: string) {
  const workflow = await findWorkflow(userId, id);
  await Promise.all([
    workflow.deleteOne(),
    WorkflowRun.deleteMany({ userId, workflowId: workflow._id }),
  ]);
}

export async function listWorkflowRuns(userId: string, id: string, page: number, pageSize: number) {
  const workflow = await findWorkflow(userId, id);
  const [docs, total] = await Promise.all([
    WorkflowRun.find({ userId, workflowId: workflow._id }).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
    WorkflowRun.countDocuments({ userId, workflowId: workflow._id }),
  ]);
  return { items: docs.map(toRunDto), total, page, pageSize };
}

export async function getWorkflowRun(userId: string, runId: string) {
  if (!mongoose.isValidObjectId(runId)) throw new AppError(404, 40401, "工作流运行记录不存在");
  const run = await WorkflowRun.findOne({ _id: runId, userId });
  if (!run) throw new AppError(404, 40401, "工作流运行记录不存在");
  return toRunDto(run);
}

function assertInputs(inputKeys: string[], inputs: Record<string, string>) {
  const missing = inputKeys.filter((key) => !inputs[key]?.trim());
  if (missing.length) throw new AppError(400, 40001, `缺少工作流输入：${missing.join("、")}`);
}

export async function createWorkflowRun(userId: string, id: string, inputs: Record<string, string>) {
  const workflow = await findWorkflow(userId, id);
  const snapshots = workflow.steps.map((step) => ({
    id: step.id,
    variables: step.variables,
    bindings: normalizedBindings(step.bindings),
  }));
  assertInputs(getWorkflowInputKeys(snapshots), inputs);

  const run = await WorkflowRun.create({
    userId,
    workflowId: workflow._id,
    workflowName: workflow.name,
    workflowVersion: workflow.version,
    inputs,
    status: "running",
    steps: workflow.steps.map((step) => ({
      stepId: step.id,
      promptName: step.promptName,
      promptVersion: step.promptVersion,
      promptContent: step.promptContent,
      variables: step.variables,
      model: step.model,
      bindings: normalizedBindings(step.bindings),
      status: "pending",
    })),
  });
  return toRunDto(run);
}

export async function retryWorkflowRun(userId: string, workflowId: string, runId: string) {
  const workflow = await findWorkflow(userId, workflowId);
  if (!mongoose.isValidObjectId(runId)) throw new AppError(404, 40401, "工作流运行记录不存在");
  const previous = await WorkflowRun.findOne({ _id: runId, userId, workflowId: workflow._id });
  if (!previous) throw new AppError(404, 40401, "工作流运行记录不存在");
  if (previous.status !== "error") throw new AppError(400, 40001, "只有失败的工作流运行可以重试");

  const failedIndex = previous.steps.findIndex((step) => step.status === "error");
  if (failedIndex < 0) throw new AppError(400, 40001, "运行记录中没有可重试的失败步骤");
  const run = await WorkflowRun.create({
    userId,
    workflowId: workflow._id,
    workflowName: previous.workflowName,
    workflowVersion: previous.workflowVersion,
    retryOfRunId: previous._id,
    inputs: normalizedBindings(previous.inputs),
    status: "running",
    steps: previous.steps.map((step, index) => ({
      stepId: step.stepId,
      promptName: step.promptName,
      promptVersion: step.promptVersion,
      promptContent: step.promptContent,
      variables: step.variables,
      model: step.model,
      bindings: normalizedBindings(step.bindings),
      input: index < failedIndex ? step.input : "",
      output: index < failedIndex ? step.output : "",
      status: index < failedIndex ? "success" : "pending",
      duration: index < failedIndex ? step.duration : 0,
      tokenUsage: index < failedIndex ? step.tokenUsage : emptyUsage,
    })),
  });
  return toRunDto(run);
}

/** 单次模型调用的时限是 180 秒；超过这个宽限仍停留在执行中的运行，视为执行进程已消失。 */
const STALE_RUN_GRACE_MS = 10 * 60_000;

/**
 * 认领后执行进程崩溃的运行会一直停在 running，且不会再有执行者接手。
 * 这里把它收敛成可重试的失败状态，避免用户只能看到一条永远“执行中”的记录。
 */
export async function recoverStaleWorkflowRuns(now = new Date()) {
  const stale = await WorkflowRun.find({
    status: "running",
    executionClaimed: true,
    updatedAt: { $lt: new Date(now.getTime() - STALE_RUN_GRACE_MS) },
  }).limit(50);
  let recovered = 0;
  for (const run of stale) {
    const interrupted = run.steps.find((step) => step.status !== "success");
    if (interrupted) {
      interrupted.status = "error";
      interrupted.errorMessage = "执行中断：服务进程可能已退出，可从该步骤重试";
    }
    run.status = "error";
    run.finishedAt = now;
    await run.save();
    recovered += 1;
  }
  return recovered;
}

export interface WorkflowStreamHandlers {
  signal: AbortSignal;
  onEvent: (event: Record<string, unknown>) => void;
}

export async function executeWorkflowRun(userId: string, runId: string, handlers: WorkflowStreamHandlers) {
  if (!mongoose.isValidObjectId(runId)) throw new AppError(404, 40401, "工作流运行记录不存在");
  const run = await WorkflowRun.findOneAndUpdate({ _id: runId, userId, status: "running", executionClaimed: { $ne: true } }, { $set: { executionClaimed: true } }, { new: true });
  if (!run) throw new AppError(404, 40401, "工作流运行记录不存在");
  if (run.status !== "running") throw new AppError(409, 40001, "工作流运行已结束");

  const inputs = normalizedBindings(run.inputs);
  const stepOutputs = new Map(
    run.steps.filter((step) => step.status === "success").map((step) => [step.stepId, step.output]),
  );
  const write = handlers.onEvent;

  for (const step of run.steps) {
    if (step.status === "success") continue;
    if (handlers.signal.aborted) {
      step.status = "aborted";
      run.status = "aborted";
      run.finishedAt = new Date();
      await run.save();
      write({ type: "run-complete", runId, status: "aborted" });
      return;
    }

    const start = Date.now();
    try {
      const stepConfig = {
        id: step.stepId,
        variables: step.variables,
        bindings: normalizedBindings(step.bindings),
      };
      const values = resolveStepVariables(stepConfig, inputs, stepOutputs);
      step.input = renderPrompt(step.promptContent, values);
      step.status = "running";
      await run.save();
      write({ type: "step-start", stepId: step.stepId, promptName: step.promptName, model: step.model });

      let output = "";
      let usage = emptyUsage;
      for await (const event of AIService.stream(
        {
          model: step.model,
          messages: [{ role: "user", content: step.input }],
          apiKey: await getApiKeyForModel(userId, step.model),
        },
        handlers.signal,
        { userId, source: "workflow", sourceRef: `${runId}:${step.stepId}`, model: step.model, operationKey: `workflow:${runId}:${step.stepId}` },
      )) {
        if (event.type === "delta") {
          output += event.content;
          write({ type: "step-delta", stepId: step.stepId, text: event.content });
        } else if (event.type === "done") {
          usage = event.usage;
        }
      }

      if (handlers.signal.aborted) {
        step.output = output;
        step.duration = Date.now() - start;
        step.tokenUsage = usage;
        step.status = "aborted";
        run.status = "aborted";
        run.finishedAt = new Date();
        await run.save();
        write({ type: "run-complete", runId, status: "aborted" });
        return;
      }
      if (!output.trim()) throw new AppError(502, 50000, "模型返回了空结果，无法继续工作流");

      step.output = output;
      step.duration = Date.now() - start;
      step.tokenUsage = usage;
      step.status = "success";
      step.errorMessage = "";
      await run.save();
      stepOutputs.set(step.stepId, output);
      write({
        type: "step-complete",
        stepId: step.stepId,
        output,
        duration: step.duration,
        tokenUsage: usage,
      });
    } catch (error) {
      if (handlers.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        step.duration = Date.now() - start;
        step.status = "aborted";
        run.status = "aborted";
        run.finishedAt = new Date();
        await run.save();
        write({ type: "run-complete", runId, status: "aborted" });
        return;
      }
      const message = error instanceof Error ? error.message : "工作流步骤执行失败";
      step.duration = Date.now() - start;
      step.status = "error";
      step.errorMessage = message;
      run.status = "error";
      run.finishedAt = new Date();
      await run.save();
      write({ type: "step-error", stepId: step.stepId, message, code: error instanceof AppError ? error.code : 50000 });
      write({ type: "run-complete", runId, status: "error" });
      return;
    }
  }

  run.status = "success";
  run.finishedAt = new Date();
  await run.save();
  write({ type: "run-complete", runId, status: "success" });
}
