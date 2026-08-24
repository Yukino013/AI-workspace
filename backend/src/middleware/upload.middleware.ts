import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

/** 允许的头像图片 MIME 类型 */
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** 头像大小上限：2MB */
const MAX_SIZE = 2 * 1024 * 1024;

// 启动时确保上传目录存在
fs.mkdirSync(config.uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, config.uploadDir),
  filename: (_req, file, cb) => {
    // 随机文件名 + 原始扩展名，避免重名覆盖与路径注入
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${randomUUID()}${ext}`);
  },
});

/**
 * 头像上传中间件：单文件，表单字段名 `avatar`。
 * fileFilter 拒绝非图片类型；超限的 MulterError 由统一错误处理转换。
 */
export const uploadAvatar = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new AppError(400, 40001, '仅支持 jpg / png / webp / gif 图片'));
    }
    cb(null, true);
  },
}).single('avatar');
