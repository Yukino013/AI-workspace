import { Router } from "express";
import { auth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { chatSchema } from "../schemas/chat.schema.js";
import { recordDetail, records, removeRecord, run, stream } from "../controllers/chat.controller.js";

// 挂载在 /api/chat：Prompt 工作台的单次运行（非流式 / 流式）
const router = Router();
router.use(auth);

router.post("/", validate(chatSchema), run);
router.post("/stream", validate(chatSchema), stream);

export default router;

// 挂载在 /api/chat-records：Prompt 调用历史（见设计文档第 8 章 CallRecords）
export const recordRoutes = Router();
recordRoutes.use(auth);

recordRoutes.get("/", records);
recordRoutes.get("/:id", recordDetail);
recordRoutes.delete("/:id", removeRecord);
