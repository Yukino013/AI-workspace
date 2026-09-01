import mongoose from 'mongoose';
import { ChatSession } from '../models/chat-session.model.js';
import { ChatMessage } from '../models/chat-message.model.js';
import { AIService } from './ai/ai.service.js';
import { getApiKeyForModel } from './provider.service.js';
import { AppError } from '../utils/AppError.js';
import type { ChatMessage as AIMessage, TokenUsage } from './ai/openai-client.js';

function assertId(id: string) { if (!mongoose.isValidObjectId(id)) throw new AppError(404, 40401, '会话不存在'); }
function dto(doc: any) { return { id: String(doc._id), title: doc.title, model: doc.model, createdAt: new Date(doc.createdAt).toISOString(), updatedAt: new Date(doc.updatedAt).toISOString() }; }
function messageDto(doc: any) { return { id: String(doc._id), role: doc.role, content: doc.content, tokenUsage: doc.tokenUsage, createdAt: new Date(doc.createdAt).toISOString() }; }

export async function listConversations(userId: string) { return (await ChatSession.find({ userId }).sort({ updatedAt: -1 })).map(dto); }
export async function createConversation(userId: string, model: string) { return dto(await ChatSession.create({ userId, model, title: '新会话' })); }
export async function updateConversation(userId: string, id: string, model: string) { const session = await owned(userId, id); session.set('model', model); await session.save(); return dto(session); }
export async function getConversation(userId: string, id: string) {
  assertId(id); const session = await ChatSession.findOne({ _id: id, userId });
  if (!session) throw new AppError(404, 40401, '会话不存在');
  const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 });
  return { ...dto(session), messages: messages.map(messageDto) };
}
export async function deleteConversation(userId: string, id: string) {
  assertId(id); const session = await ChatSession.findOneAndDelete({ _id: id, userId });
  if (!session) throw new AppError(404, 40401, '会话不存在');
  await ChatMessage.deleteMany({ sessionId: id });
}

async function owned(userId: string, id: string) {
  assertId(id); const session = await ChatSession.findOne({ _id: id, userId });
  if (!session) throw new AppError(404, 40401, '会话不存在');
  return session;
}

export async function prepareMessage(userId: string, id: string, content: string) {
  const session = await owned(userId, id);
  const previous = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: 1 });
  await ChatMessage.create({ sessionId: session._id, role: 'user', content });
  const messages: AIMessage[] = [...previous.map((m) => ({ role: m.role, content: m.content } as AIMessage)), { role: 'user', content }];
  if (session.title === '新会话') { session.title = content.slice(0, 30); await session.save(); }
  return { session, messages };
}

export async function runMessage(userId: string, id: string, content: string) {
  const { session, messages } = await prepareMessage(userId, id, content);
  const result = await AIService.chat({ model: session.model, messages, apiKey: await getApiKeyForModel(userId, session.model) });
  const message = await ChatMessage.create({ sessionId: session._id, role: 'assistant', content: result.content, tokenUsage: result.usage });
  session.updatedAt = new Date(); await session.save();
  return { session: dto(session), message: messageDto(message) };
}

export async function streamMessage(userId: string, id: string, content: string, onDelta: (text: string) => void, signal: AbortSignal) {
  const { session, messages } = await prepareMessage(userId, id, content); let output = ''; let usage: TokenUsage | undefined;
  for await (const event of AIService.stream({ model: session.model, messages, apiKey: await getApiKeyForModel(userId, session.model) }, signal)) {
    if (event.type === 'delta') { output += event.content; onDelta(event.content); } else usage = event.usage;
  }
  if (!signal.aborted) { await ChatMessage.create({ sessionId: session._id, role: 'assistant', content: output, tokenUsage: usage }); session.updatedAt = new Date(); await session.save(); }
  return dto(session);
}
