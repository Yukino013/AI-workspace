import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { workflowInputSchema, workflowRunInputSchema } from "../schemas/workflow.schema.js";
import * as controller from "../controllers/workflow.controller.js";

const router = Router();
router.use(auth);
router.get("/", controller.list);
router.post("/", validate(workflowInputSchema), controller.create);
router.get("/:id/runs", controller.runs);
router.post("/:id/runs/stream", validate(workflowRunInputSchema), controller.startRun);
router.post("/:id/runs/:runId/retry/stream", controller.retryRun);
router.get("/:id", controller.getOne);
router.put("/:id", validate(workflowInputSchema), controller.update);
router.delete("/:id", controller.remove);
export default router;
