import http from './http';
import type { ProviderConfig } from '@/types';

export function getProviders(): Promise<ProviderConfig[]> {
  return http.get('/providers');
}

export function updateProviders(values: Partial<Record<ProviderConfig['id'], string>>): Promise<ProviderConfig[]> {
  return http.patch('/providers', values);
}
