import 'dotenv/config';
import path from 'node:path';
import { resolveJwtSecret } from './jwt-secret.js';

// 在配置模块加载时校验，失败则在数据库连接和 HTTP 监听之前终止启动。
const jwtSecret = resolveJwtSecret(process.env);

/** 集中读取环境变量，避免散落在各处。见设计文档第 15 章 */
export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/ai-workbench',
  /** 头像等上传文件的落盘目录（相对于 backend 运行目录） */
  uploadDir: process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), 'uploads'),
  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  // 内置默认 Provider：API Key 只存后端 .env，绝不下发前端
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY ?? '',
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
  },
  qwen: {
    apiKey: process.env.QWEN_API_KEY ?? '',
    baseUrl: process.env.QWEN_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? '',
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? 'https://api.anthropic.com',
  },
};
