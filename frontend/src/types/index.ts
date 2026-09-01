export interface User {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
}

export interface LoginData {
  token: string;
  user: User;
}

export interface Prompt {
  id: string;
  name: string;
  description: string;
  content: string;
  variables: string[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromptVersion {
  id: string;
  promptId: string;
  version: number;
  content: string;
  variables: string[];
  createdAt: string;
  createdBy: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatRecord {
  id: string;
  promptId: string;
  promptName?: string;
  promptVersion: number;
  model: string;
  input: string;
  output: string;
  duration: number;
  tokenUsage?: TokenUsage;
  status: 'success' | 'error' | 'aborted';
  errorMessage?: string;
  createdAt: string;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ProviderConfig {
  id: 'deepseek' | 'qwen' | 'anthropic';
  name: string;
  model: string;
  configured: boolean;
  hasCustomKey: boolean;
  maskedKey: string;
}
