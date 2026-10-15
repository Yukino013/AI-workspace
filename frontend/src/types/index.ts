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

export interface Conversation { id: string; title: string; model: string; createdAt: string; updatedAt: string; }
export interface ConversationMessage { id: string; role: 'user' | 'assistant'; content: string; tokenUsage?: TokenUsage; createdAt: string; }
export interface ConversationDetail extends Conversation { messages: ConversationMessage[]; }
export interface CodeTool { key: string; name: string; description: string; inputHint: string; }
export interface HistoryItem { id: string; type: 'chat' | 'code-tool'; title: string; model: string; input: string; output: string; createdAt: string; conversationId?: string; toolKey?: string; language?: string; status?: 'success' | 'error' | 'aborted'; errorMessage?: string; }

export interface WorkflowStep {
  id: string;
  promptId: string;
  promptName: string;
  promptVersion: number;
  promptContent: string;
  variables: string[];
  model: string;
  bindings: Record<string, string>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  steps: WorkflowStep[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepRun {
  stepId: string;
  promptName: string;
  promptVersion: number;
  model: string;
  input: string;
  output: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'aborted';
  duration: number;
  tokenUsage: TokenUsage;
  errorMessage?: string;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  retryOfRunId?: string;
  inputs: Record<string, string>;
  status: 'running' | 'success' | 'error' | 'aborted';
  steps: WorkflowStepRun[];
  startedAt: string;
  finishedAt: string;
  createdAt: string;
}
