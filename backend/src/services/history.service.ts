import { ChatSession } from "../models/chat-session.model.js";
import { ChatMessage } from "../models/chat-message.model.js";
import { CodeToolRecord } from "../models/code-tool-record.model.js";

export async function listHistory(
  userId: string,
  query: { keyword?: string; type?: string; page: number; pageSize: number },
) {
  const regex = query.keyword
    ? new RegExp(query.keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : undefined;
  const [sessions, tools] = await Promise.all([
    query.type === "code-tool"
      ? []
      : ChatSession.find({ userId }).sort({ updatedAt: -1 }).lean(),
    query.type === "chat"
      ? []
      : CodeToolRecord.find({
          userId,
          ...(regex
            ? { $or: [{ title: regex }, { input: regex }, { output: regex }] }
            : {}),
        })
          .sort({ createdAt: -1 })
          .lean(),
  ]);
  const allMessages = sessions.length
    ? await ChatMessage.find({
        sessionId: { $in: sessions.map((session) => session._id) },
      })
        .sort({ createdAt: -1 })
        .lean()
    : [];
  const bySession = new Map<string, typeof allMessages>();
  for (const message of allMessages) {
    const key = String(message.sessionId);
    const group = bySession.get(key) ?? [];
    group.push(message);
    bySession.set(key, group);
  }
  const chatItems = sessions
    .map((session) => {
      const messages = bySession.get(String(session._id)) ?? [];
      const latestUser = messages.find((message) => message.role === "user");
      const latestAssistant = messages.find(
        (message) => message.role === "assistant",
      );
      const matched = regex
        ? messages.find((message) => regex.test(message.content))
        : undefined;
      if (regex && !regex.test(session.title) && !matched) return null;
      // A search result previews the matched message, even when it is from an older turn.
      const input =
        matched?.role === "user"
          ? matched.content
          : (latestUser?.content ?? "");
      const output =
        matched?.role === "assistant"
          ? matched.content
          : (latestAssistant?.content ?? "");
      return {
        id: String(session._id),
        type: "chat" as const,
        title: session.title,
        model: session.model,
        input,
        output,
        createdAt: new Date(session.updatedAt).toISOString(),
        conversationId: String(session._id),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const items = [
    ...chatItems,
    ...tools.map((record) => ({
      id: String(record._id),
      type: "code-tool" as const,
      title: record.title,
      model: record.model,
      input: record.input,
      output: record.output,
      createdAt: new Date(record.createdAt).toISOString(),
      toolKey: record.toolKey,
      language: record.language,
      status: record.status,
      errorMessage: record.errorMessage,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const start = (query.page - 1) * query.pageSize;
  return {
    items: items.slice(start, start + query.pageSize),
    total: items.length,
    page: query.page,
    pageSize: query.pageSize,
  };
}
