import mongoose from 'mongoose';
import app from './app.js';
import { ensureUsageReady, recoverUsage } from './services/usage/quota.service.js';
import { recoverStaleWorkflowRuns } from './services/workflow.service.js';
import { config } from './config/index.js';

async function main() {
  // 先连数据库，连不上直接退出，避免带着坏状态启动
  await mongoose.connect(config.mongoUri);
  console.log(`MongoDB connected: ${config.mongoUri}`);

  try { await ensureUsageReady(); await recoverUsage(); await recoverStaleWorkflowRuns(); }
  catch (error) { console.error('额度模块未就绪:', error instanceof Error ? error.message : '数据库不可用'); }
  let recovering = false;
  const recovery = setInterval(async () => {
    if (recovering) return;
    recovering = true;
    try { await recoverUsage(); await recoverStaleWorkflowRuns(); } catch { /* generation endpoints remain fail-closed */ }
    finally { recovering = false; }
  }, 30_000);
  recovery.unref();

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
