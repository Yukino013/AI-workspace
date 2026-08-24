import { Router } from 'express';
import { auth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createPromptSchema, updatePromptSchema } from '../schemas/prompt.schema.js';
import {
  create,
  getOne,
  list,
  remove,
  restore,
  update,
  versions,
} from '../controllers/prompt.controller.js';

const router = Router();

// 所有 Prompt 接口都需要登录（见设计文档第 8 章）
router.use(auth);

router.get('/', list);
router.post('/', validate(createPromptSchema), create);
router.get('/:id', getOne);
router.put('/:id', validate(updatePromptSchema), update);
router.delete('/:id', remove);
router.get('/:id/versions', versions);
router.post('/:id/versions/:version/restore', restore);

export default router;
