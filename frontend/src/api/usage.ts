import http from './http';
export const sourceLabels: Record<string, string> = { prompt: 'Prompt', conversation: 'AI 对话', code_tool: '代码工具', workflow: '工作流' };
export interface UsageOverview {
  timezone: string; date: string;
  quota: { dailyLimit: number; consumed: number; reserved: number; available: number; activeRequests: number; maxActiveRequests: number };
  today: { startedRequests: number; successRequests: number; failedRequests: number; cancelledRequests: number; reportedInputTokens: number; reportedOutputTokens: number; estimatedChargedTokens: number };
  trend: Array<{ date: string; consumedTokens: number; reservedTokens: number; requests: number }>;
  bySource: Array<{ source: string; tokens: number; requests: number; estimatedRequests: number }>;
  byModel: Array<{ model: string; tokens: number; requests: number }>;
}
export interface UsageRecord {
  id: string; date: string; source: string; model: string; status: string; outcome: string | null;
  chargedTokens: number | null; reservedTokens: number; usageSource: string | null;
  reportedInputTokens: number | null; reportedOutputTokens: number | null; reportedTotalTokens: number | null;
  recovered: boolean; createdAt: string; finishedAt: string | null;
}
export interface UsagePage { items: UsageRecord[]; total: number; page: number; pageSize: number }
export interface UsageFilters { page: number; pageSize: number; source?: string; model?: string; date?: string }
export const getUsageOverview = (days: 7 | 30): Promise<UsageOverview> => http.get('/usage/overview', { params: { days } });
export const getUsageRecords = (params: UsageFilters): Promise<UsagePage> => http.get('/usage/records', { params });
export const updateDailyQuota = (dailyTokenLimit: number): Promise<{ dailyTokenLimit: number }> => http.patch('/usage/quota', { dailyTokenLimit });
export const formatTokens = (value: number | null) => value === null ? '未知' : value.toLocaleString('zh-CN');
