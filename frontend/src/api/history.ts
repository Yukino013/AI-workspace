import http from './http'; import type { HistoryItem, PageResult } from '@/types';
export const getHistory = (params: { keyword?: string; type?: string; page?: number; pageSize?: number }): Promise<PageResult<HistoryItem>> => http.get('/history', { params });
