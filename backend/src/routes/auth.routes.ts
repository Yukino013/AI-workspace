import { Router } from 'express';
import { login, me, register, updateAvatar, updateProfile } from '../controllers/auth.controller.js';
import { auth } from '../middleware/auth.middleware.js';
import { uploadAvatar } from '../middleware/upload.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { loginSchema, registerSchema, updateProfileSchema } from '../schemas/auth.schema.js';

const router = Router();

// 公开接口
router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);

// 需要登录
router.get('/me', auth, me);
router.patch('/profile', auth, validate(updateProfileSchema), updateProfile);
router.post('/avatar', auth, uploadAvatar, updateAvatar);

export default router;
