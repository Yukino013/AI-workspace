import { User } from '../models/user.model.js';
import { AI_MODELS } from './ai/ai.service.js';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

export type ProviderKey = 'deepseek' | 'qwen' | 'anthropic';
const keyFields: Record<ProviderKey, 'deepseekApiKey' | 'qwenApiKey' | 'anthropicApiKey'> = {
  deepseek: 'deepseekApiKey',
  qwen: 'qwenApiKey',
  anthropic: 'anthropicApiKey',
};

const providerMeta = {
  deepseek: { name: 'DeepSeek', model: AI_MODELS.DEEPSEEK, defaultKey: config.deepseek.apiKey },
  qwen: { name: 'Qwen（通义千问）', model: AI_MODELS.QWEN, defaultKey: config.qwen.apiKey },
  anthropic: { name: 'Claude（Anthropic）', model: AI_MODELS.ANTHROPIC, defaultKey: config.anthropic.apiKey },
} satisfies Record<ProviderKey, { name: string; model: string; defaultKey: string }>;

function maskKey(key: string) {
  if (!key) return '';
  if (key.length <= 8) return `${key.slice(0, 2)}****`;
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

export async function listProviders(userId: string) {
  const user = await User.findById(userId).select('+deepseekApiKey +qwenApiKey +anthropicApiKey');
  if (!user) throw new AppError(404, 40401, '用户不存在');

  return (Object.keys(providerMeta) as ProviderKey[]).map((id) => {
    const customKey = user[keyFields[id]] ?? '';
    return {
      id,
      name: providerMeta[id].name,
      model: providerMeta[id].model,
      configured: Boolean(customKey || providerMeta[id].defaultKey),
      hasCustomKey: Boolean(customKey),
      // 服务端默认 key 不向前端暴露任何片段；仅展示用户自定义 key 的脱敏值
      maskedKey: maskKey(customKey),
    };
  });
}

export async function saveProviders(userId: string, values: Partial<Record<ProviderKey, string>>) {
  const update: Record<string, string> = {};
  for (const id of Object.keys(values) as ProviderKey[]) {
    if (!(id in keyFields)) continue;
    const value = values[id];
    if (value !== undefined) update[keyFields[id]] = value.trim();
  }
  const user = await User.findByIdAndUpdate(userId, update, { new: true, runValidators: true });
  if (!user) throw new AppError(404, 40401, '用户不存在');
  return listProviders(userId);
}

export async function getApiKeyForModel(userId: string, model: string) {
  const provider = (Object.keys(providerMeta) as ProviderKey[]).find((id) => providerMeta[id].model === model);
  if (!provider) return undefined;
  const user = await User.findById(userId).select(`+${keyFields[provider]}`);
  if (!user) throw new AppError(404, 40401, '用户不存在');
  return user[keyFields[provider]] || undefined;
}
