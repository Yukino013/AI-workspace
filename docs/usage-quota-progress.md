# 使用量与额度模块：进度交接

记录时间：2026-10-16（Asia/Shanghai）；上一版 2026-10-15 17:51。

## 目标与范围

为 AI 工作台实现使用量与额度管理。个人每日默认额度为 **1,000,000 Token**；该额度是本应用内的调用预算，不代表模型供应商账户余额。

## 已完成并保存在工作区

- 后端额度账户、每日聚合、调用流水与幂等操作数据模型（`backend/src/models/usage.model.ts`）。
- 额度预占、开始尝试、幂等结算、额度调整、超时恢复与查询服务；每日额度按 Asia/Shanghai 日期计算（`backend/src/services/usage/*`）。
- 已登录用户的使用量概览、记录列表、额度修改 API（`/api/usage/*`）。
- Prompt、对话、代码工具以及工作流实际步骤全部接入预占与结算，无绕过入口。
- 生成类 HTTP 操作带 `Idempotency-Key` 与并发资源锁；工作流运行增加执行认领。
- 前端使用量页面、额度设置、趋势/分类展示与分页流水，导航已加入口（`/usage`）。
- 模块开发说明 `docs/usage-quota-development.md`。
- 测试：`backend/tests/usage-rules.test.mjs`、`usage-integration.test.mjs`、`usage-entrypoints.test.mjs`，以及 `npm run test:usage` 脚本。

## 本次续做内容（2026-10-16）

- 开发文档口径修正：默认额度 100,000 → 1,000,000，并更新“已实现，待测试与验收”的状态说明。
- 修复 startAttempt 失败时的预占泄漏：非流式与流式两条路径都会以 `not_sent` 结算并释放额度与并发计数。
- Anthropic usage 叠加 `cache_creation_input_tokens` / `cache_read_input_tokens`，避免缓存输入被低估；流式 `max_tokens` 跟随请求而不是写死 4096。
- 新增 `recoverStaleWorkflowRuns`：认领后超过 10 分钟没有更新的 running 运行收敛为可重试的 error，由启动流程与 30 秒定时器调用。
- 幂等操作锁有效期从 45 分钟缩短为“请求时限 + 1 分钟”；概览接口的并发上限改用 `MAX_ACTIVE_REQUESTS` 常量。

## 已验证

- 后端：`npm test --prefix backend` → 46 个用例全部通过（含额度单元与两套事务集成测试）。
- 前端：`npm run build --prefix frontend` 通过，产物包含 `UsageView`。
- 副本集：在 `27018` + 临时数据目录 `/tmp` 下启动单节点副本集完成验证，未读写既有 `27017` 实例的数据；测试使用随机数据库名并在结束时自动清理。

## 尚未完成

- 未使用真实 Provider 账号验证账单口径、限流与断流行为。
- 未做浏览器人工验收（桌面 / 移动端的概览、筛选、分页、额度修改、额度不足提示）。
- 明细接口的筛选范围比设计文档窄：实现支持单日 `date`、来源与模型筛选，没有 `startDate` / `endDate` 区间与 `outcome` 筛选。
- 安全清单上的上传限流 / 存储配额、孤立文件清理仍未做（与本模块无直接关系）。
- 全部改动仍保留在工作区，**未提交 git**。

## 重要限制

- 额度功能依赖 MongoDB 副本集或 mongos；standalone 实例上生成接口按设计返回 `50301`，不会降级为“先查再扣”。
- 单节点副本集只适用于本地开发与测试。
- 第一版不涉及供应商余额、充值、套餐与人民币计费。
