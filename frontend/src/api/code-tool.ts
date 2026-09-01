import http from './http'; import type { CodeTool } from '@/types';
export const getCodeTools = (): Promise<CodeTool[]> => http.get('/code-tools');
export const runCodeTool = (key: string, payload: { model: string; code: string; language?: string }) => http.post(`/code-tools/${key}/run`, payload);
