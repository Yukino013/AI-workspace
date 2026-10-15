import { Schema, model } from "mongoose";
import type { InferSchemaType } from "mongoose";

const workflowStepSchema = new Schema(
  {
    id: { type: String, required: true },
    promptId: { type: Schema.Types.ObjectId, required: true },
    promptName: { type: String, required: true },
    promptVersion: { type: Number, required: true },
    promptContent: { type: String, required: true },
    variables: { type: [String], default: [] },
    model: { type: String, required: true },
    bindings: { type: Map, of: String, default: {} },
  },
  { _id: false },
);

const workflowSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    version: { type: Number, required: true, default: 1 },
    steps: { type: [workflowStepSchema], required: true },
  },
  { timestamps: true },
);

workflowSchema.index({ userId: 1, updatedAt: -1 });

export type WorkflowDoc = InferSchemaType<typeof workflowSchema>;
export const Workflow = model("Workflow", workflowSchema);
