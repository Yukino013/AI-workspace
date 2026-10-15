import { AppError } from "../utils/AppError.js";

export interface WorkflowBindingStep {
  id: string;
  variables: string[];
  bindings: Record<string, string>;
}

export function validateWorkflowBindings(steps: WorkflowBindingStep[]) {
  const seenIds = new Set<string>();
  for (const [index, step] of steps.entries()) {
    if (seenIds.has(step.id)) {
      throw new AppError(400, 40001, `步骤 ${index + 1} 的 ID 重复`);
    }

    for (const variable of step.variables) {
      const source = step.bindings[variable];
      if (!source) {
        throw new AppError(400, 40001, `步骤 ${index + 1} 缺少变量 ${variable} 的输入映射`);
      }

      const inputMatch = /^input\.([A-Za-z0-9_]+)$/.exec(source);
      if (inputMatch) continue;

      const stepMatch = /^steps\.([A-Za-z0-9_-]+)\.output$/.exec(source);
      if (!stepMatch || !seenIds.has(stepMatch[1])) {
        throw new AppError(400, 40001, `步骤 ${index + 1} 的输入映射必须引用初始输入或更早步骤`);
      }
    }
    seenIds.add(step.id);
  }
}

export function getWorkflowInputKeys(steps: WorkflowBindingStep[]): string[] {
  return [
    ...new Set(
      steps.flatMap((step) =>
        Object.values(step.bindings)
          .map((source) => /^input\.([A-Za-z0-9_]+)$/.exec(source)?.[1])
          .filter((key): key is string => Boolean(key)),
      ),
    ),
  ];
}

export function resolveStepVariables(
  step: WorkflowBindingStep,
  inputs: Record<string, string>,
  stepOutputs: Map<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    step.variables.map((variable) => {
      const source = step.bindings[variable];
      const inputKey = /^input\.([A-Za-z0-9_]+)$/.exec(source)?.[1];
      const previousStepId = /^steps\.([A-Za-z0-9_-]+)\.output$/.exec(source)?.[1];
      const value = inputKey ? inputs[inputKey] : previousStepId ? stepOutputs.get(previousStepId) : undefined;
      if (!value?.trim()) {
        throw new AppError(400, 40001, `步骤 ${step.id} 缺少变量 ${variable} 的有效输入`);
      }
      return [variable, value];
    }),
  );
}
