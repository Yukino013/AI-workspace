import http from './http'; import type { Conversation, ConversationDetail } from '@/types';
export const getConversations = (): Promise<Conversation[]> => http.get('/conversations');
export const createConversation = (model: string): Promise<Conversation> => http.post('/conversations', { model });
export const getConversation = (id: string): Promise<ConversationDetail> => http.get(`/conversations/${id}`);
export const updateConversation = (id: string, model: string): Promise<Conversation> => http.patch(`/conversations/${id}`, { model });
export const deleteConversation = (id: string): Promise<null> => http.delete(`/conversations/${id}`);
export const sendConversationMessage = (id: string, content: string) => http.post(`/conversations/${id}/messages`, { content });
