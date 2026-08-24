import http from "./http";
import type { ChatRecord, PageResult } from "@/types";

export interface ChatPayload {
  promptId: string;
  model: string;
  variables: Record<string, string>;
}

/** 非流式：一次性返回完整结果 */
export function sendChat(payload: ChatPayload): Promise<ChatRecord> {
  return http.post("/chat", payload);
}

export function getChatRecords(params: { page?: number; pageSize?: number }): Promise<PageResult<ChatRecord>> {
  return http.get("/chat-records", { params });
}

export function getChatRecord(id: string): Promise<ChatRecord> {
  return http.get(`/chat-records/${id}`);
}

export function deleteChatRecord(id: string): Promise<null> {
  return http.delete(`/chat-records/${id}`);
}
