import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const tokenUsageSchema = new Schema(
  {
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  { _id: false },
);

const workflowRunStepSchema = new Schema(
  {
    stepId: { type: String, required: true },
    promptName: { type: String, required: true },
    promptVersion: { type: Number, required: true },
    promptContent: { type: String, required: true },
    variables: { type: [String], default: [] },
    model: { type: String, required: true },
    bindings: { type: Map, of: String, default: {} },
    input: { type: String, default: "" },
    output: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "running", "success", "error", "aborted"],
      default: "pending",
    },
    duration: { type: Number, default: 0 },
    tokenUsage: { type: tokenUsageSchema, default: () => ({}) },
    errorMessage: { type: String, default: "" },
  },
  { _id: false },
);

const workflowRunSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    workflowId: { type: Schema.Types.ObjectId, required: true, index: true },
    workflowName: { type: String, required: true },
    workflowVersion: { type: Number, required: true },
    retryOfRunId: { type: Schema.Types.ObjectId, default: null },
    inputs: { type: Map, of: String, default: {} },
    status: {
      type: String,
      enum: ["running", "success", "error", "aborted"],
      required: true,
      default: "running",
    },
    steps: { type: [workflowRunStepSchema], required: true },
    executionClaimed: { type: Boolean, default: false },
    startedAt: { type: Date, required: true, default: Date.now },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

workflowRunSchema.index({ userId: 1, workflowId: 1, createdAt: -1 });

export type WorkflowRunDoc = InferSchemaType<typeof workflowRunSchema>;
export const WorkflowRun = model("WorkflowRun", workflowRunSchema);
