import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes.js';
import promptRoutes from './routes/prompt.routes.js';
import chatRoutes, { recordRoutes } from './routes/chat.routes.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import { config } from './config/index.js';
import { ok } from './utils/response.js';
import providerRoutes from './routes/provider.routes.js';

const app = express();

// 安全响应头
app.use(helmet());
// 开发用 Vite 代理，无需放开 CORS；此处保留 cors() 便于直接用 curl 调试
app.use(cors());
// 开发日志
app.use(morgan('dev'));
// 解析 JSON 请求体
app.use(express.json());

// 上传文件静态托管：/uploads/xxx.png 直接访问
app.use('/uploads', express.static(config.uploadDir));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json(ok({ status: 'ok', time: new Date().toISOString() }));
});

// 业务路由
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/chat-records', recordRoutes);

// 404 与统一错误处理，必须放在所有路由之后
app.use(notFound);
app.use(errorHandler);

export default app;
