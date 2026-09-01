import { Router } from 'express';
import { auth } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { providers, updateProviders } from '../controllers/provider.controller.js';
import { providerSchema } from '../schemas/provider.schema.js';

const router = Router();
router.use(auth);
router.get('/', providers);
router.patch('/', validate(providerSchema), updateProviders);
export default router;
