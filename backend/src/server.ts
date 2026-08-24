import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config/index.js';

async function main() {
  // 先连数据库，连不上直接退出，避免带着坏状态启动
  await mongoose.connect(config.mongoUri);
  console.log(`MongoDB connected: ${config.mongoUri}`);

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
