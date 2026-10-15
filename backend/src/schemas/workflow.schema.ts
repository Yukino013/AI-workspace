import { z } from "zod";

const workflowStepSchema = z.object({
  id: z.string().min(1).max(50),
  promptId: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  bindings: z.record(z.string().regex(/^\w+$/), z.string().min(1).max(100)),
}).strict();

export const workflowInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  steps: z.array(workflowStepSchema).min(1).max(10),
}).strict();

export const workflowRunInputSchema = z.object({
  inputs: z.record(z.string().regex(/^\w+$/), z.string().max(50000)).default({}),
}).strict();
