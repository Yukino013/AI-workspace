import multer from 'multer';
import { AppError } from '../utils/AppError.js';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** 原始文件仅暂存在内存；实际内容校验和重新编码成功后才允许写入公开目录。 */
export const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  // Busboy 在达到 parts 数时就触发限制；文件与文本字段另由 files / fields 严格限制。
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
  fileFilter: (_req, file, cb) => {
    // MIME 只用于初筛，不能证明文件内容是图片。
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new AppError(400, 40001, '仅支持 jpg / png / webp / gif 图片'));
    }
    cb(null, true);
  },
}).single('avatar');
