import assert from "node:assert/strict";
import { test } from "node:test";
import { validateWorkflowBindings, getWorkflowInputKeys, resolveStepVariables } from "../dist/services/workflow-utils.js";
import { workflowInputSchema, workflowRunInputSchema } from "../dist/schemas/workflow.schema.js";

const stepA = {
  id: "draft",
  variables: ["topic"],
  bindings: { topic: "input.topic" },
};
const stepB = {
  id: "review",
  variables: ["content", "tone"],
  bindings: { content: "steps.draft.output", tone: "input.tone" },
};

test("workflow bindings accept input fields and outputs from prior steps", () => {
  validateWorkflowBindings([stepA, stepB]);
  assert.deepEqual(getWorkflowInputKeys([stepA, stepB]), ["topic", "tone"]);
  assert.deepEqual(
    resolveStepVariables(stepB, { tone: "concise" }, new Map([["draft", "First draft"]])),
    { content: "First draft", tone: "concise" },
  );
});

test("workflow bindings reject missing, self and forward references", () => {
  for (const binding of ["", "steps.review.output", "steps.future.output", "input.bad-key"]) {
    assert.throws(
      () => validateWorkflowBindings([{ id: "review", variables: ["content"], bindings: { content: binding } }]),
      /缺少变量|更早步骤/,
    );
  }
  assert.throws(
    () => validateWorkflowBindings([stepA, { ...stepB, bindings: { ...stepB.bindings, content: "steps.future.output" } }]),
    /更早步骤/,
  );
});

test("workflow bindings reject duplicate step IDs and empty runtime values", () => {
  assert.throws(() => validateWorkflowBindings([stepA, { ...stepA }]), /ID 重复/);
  assert.throws(
    () => resolveStepVariables(stepB, { tone: " " }, new Map([["draft", ""]])),
    /有效输入/,
  );
});

test("workflow payload validation bounds steps and rejects malformed input", () => {
  const payload = {
    name: " Draft and review ",
    description: "A small reusable flow",
    steps: [
      { id: "draft", promptId: "507f1f77bcf86cd799439011", model: "deepseek-v4-flash", bindings: { topic: "input.topic" } },
    ],
  };
  assert.equal(workflowInputSchema.parse(payload).name, "Draft and review");
  assert.equal(workflowRunInputSchema.parse({ inputs: { topic: "AI tools" } }).inputs.topic, "AI tools");
  assert.deepEqual(workflowRunInputSchema.parse({}).inputs, {});
  assert.equal(workflowInputSchema.safeParse({ ...payload, steps: Array.from({ length: 11 }, (_, index) => ({ ...payload.steps[0], id: String(index) })) }).success, false);
  assert.equal(workflowRunInputSchema.safeParse({ inputs: { topic: 42 } }).success, false);
});
