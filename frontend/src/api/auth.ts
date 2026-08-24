import http from './http';
import type { LoginData, User } from '@/types';

export function register(username: string, password: string): Promise<User> {
  return http.post('/auth/register', { username, password });
}

export function login(username: string, password: string): Promise<LoginData> {
  return http.post('/auth/login', { username, password });
}

export function getMe(): Promise<User> {
  return http.get('/auth/me');
}

export function updateProfile(nickname: string): Promise<User> {
  return http.patch('/auth/profile', { nickname });
}

export function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append('avatar', file);
  return http.post('/auth/avatar', form);
}
