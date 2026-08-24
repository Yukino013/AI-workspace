import http from './http';
import type { PageResult, Prompt, PromptVersion } from '@/types';

export interface PromptQuery {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export type PromptInput = Pick<Prompt, 'name' | 'description' | 'content'>;

export function getPrompts(params: PromptQuery): Promise<PageResult<Prompt>> {
  return http.get('/prompts', { params });
}

export function getPrompt(id: string): Promise<Prompt> {
  return http.get(`/prompts/${id}`);
}

export function createPrompt(data: PromptInput): Promise<Prompt> {
  return http.post('/prompts', data);
}

export function updatePrompt(id: string, data: PromptInput): Promise<Prompt> {
  return http.put(`/prompts/${id}`, data);
}

export function deletePrompt(id: string): Promise<null> {
  return http.delete(`/prompts/${id}`);
}

export function getVersions(id: string): Promise<PromptVersion[]> {
  return http.get(`/prompts/${id}/versions`);
}

export function restoreVersion(id: string, version: number): Promise<Prompt> {
  return http.post(`/prompts/${id}/versions/${version}/restore`);
}
