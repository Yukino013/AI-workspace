import { ChatSession } from '../models/chat-session.model.js';
import { ChatMessage } from '../models/chat-message.model.js';
import { CodeToolRecord } from '../models/code-tool-record.model.js';

export async function listHistory(userId: string, query: { keyword?: string; type?: string; page: number; pageSize: number }) {
  const regex = query.keyword ? new RegExp(query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : undefined;
  const [sessions, tools] = await Promise.all([
    query.type === 'code-tool' ? [] : ChatSession.find({ userId }).sort({ updatedAt: -1 }).lean(),
    query.type === 'chat' ? [] : CodeToolRecord.find({ userId, ...(regex ? { $or: [{ title: regex }, { input: regex }, { output: regex }] } : {}) }).sort({ createdAt: -1 }).lean(),
  ]);
  const chatItems = (await Promise.all(sessions.map(async (session) => {
    const messages = await ChatMessage.find({ sessionId: session._id }).sort({ createdAt: -1 }).lean();
    const latestUser = messages.find((message) => message.role === 'user');
    const latestAssistant = messages.find((message) => message.role === 'assistant');
    const input = latestUser?.content ?? '';
    const output = latestAssistant?.content ?? '';
    if (regex && !regex.test(session.title) && !regex.test(input) && !regex.test(output)) return null;
    return { id: String(session._id), type: 'chat' as const, title: session.title, model: session.model, input, output, createdAt: new Date(session.updatedAt).toISOString(), conversationId: String(session._id) };
  }))).filter((item): item is NonNullable<typeof item> => item !== null);
  const items = [...chatItems, ...tools.map((record) => ({ id: String(record._id), type: 'code-tool' as const, title: record.title, model: record.model, input: record.input, output: record.output, createdAt: new Date(record.createdAt).toISOString(), toolKey: record.toolKey }))].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const start = (query.page - 1) * query.pageSize;
  return { items: items.slice(start, start + query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize };
}
