import { onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  createConversation,
  deleteConversation,
  getConversation,
  getConversations,
  updateConversation,
} from "@/api/conversation";
import { MODEL_OPTIONS } from "@/utils/constants";
import { streamEndpoint } from "@/utils/sse";
import type { Conversation, ConversationDetail } from "@/types";

export function useConversations() {
  const route = useRoute();
  const conversations = shallowRef<Conversation[]>([]);
  const active = ref<ConversationDetail | null>(null);
  const model = shallowRef<string>(MODEL_OPTIONS[0].value);
  const input = shallowRef("");
  const loading = shallowRef(false);
  const busy = shallowRef(false);
  const streaming = shallowRef(false);
  const error = shallowRef("");
  let controller: AbortController | null = null;
  let streamId = 0;
  let loadId = 0;
  let listId = 0;
  let disposed = false;

  function stop() {
    streamId += 1;
    const previous = controller;
    controller = null;
    streaming.value = false;
    previous?.abort();
  }
  async function open(item: Conversation) {
    stop();
    const request = ++loadId;
    loading.value = true;
    error.value = "";
    try {
      const detail = await getConversation(item.id);
      if (disposed || request !== loadId) return;
      active.value = detail;
      model.value = detail.model;
      input.value = "";
    } catch {
      if (!disposed && request === loadId)
        error.value = "会话加载失败，请重新选择会话。";
    } finally {
      if (request === loadId) loading.value = false;
    }
  }
  async function load() {
    const request = ++listId;
    error.value = "";
    try {
      const items = await getConversations();
      if (disposed || request !== listId) return;
      conversations.value = items;
      const id =
        typeof route.query.conversationId === "string"
          ? route.query.conversationId
          : "";
      const selected = items.find((item) => item.id === id);
      if (selected && active.value?.id !== selected.id) await open(selected);
      else if (!active.value && items[0]) await open(items[0]);
    } catch {
      if (!disposed && request === listId)
        error.value = "会话列表加载失败，请重试。";
    }
  }
  async function newChat() {
    if (busy.value) return;
    busy.value = true;
    stop();
    try {
      const item = await createConversation(model.value);
      if (disposed) return;
      conversations.value = [item, ...conversations.value];
      await open(item);
    } catch {
      /* HTTP 层统一提示 */
    } finally {
      busy.value = false;
    }
  }
  async function changeModel() {
    if (!active.value || busy.value || streaming.value) return;
    const session = active.value;
    const oldModel = session.model;
    const nextModel = model.value;
    if (oldModel === nextModel) return;
    busy.value = true;
    try {
      const updated = await updateConversation(session.id, nextModel);
      if (active.value?.id === session.id) active.value.model = updated.model;
      conversations.value = conversations.value.map((item) =>
        item.id === session.id ? updated : item,
      );
    } catch {
      if (active.value?.id === session.id) model.value = oldModel;
    } finally {
      busy.value = false;
    }
  }
  async function remove(item: Conversation) {
    if (busy.value) return;
    try {
      await ElMessageBox.confirm(
        "删除后会话消息无法恢复，确定继续吗？",
        "删除会话",
        {
          type: "warning",
          confirmButtonText: "删除",
          cancelButtonText: "取消",
        },
      );
    } catch {
      return;
    }
    busy.value = true;
    try {
      if (active.value?.id === item.id) stop();
      await deleteConversation(item.id);
      conversations.value = conversations.value.filter(
        (session) => session.id !== item.id,
      );
      if (active.value?.id === item.id) {
        active.value = null;
        if (conversations.value[0]) await open(conversations.value[0]);
      }
    } catch {
      /* HTTP 层统一提示 */
    } finally {
      busy.value = false;
    }
  }
  function send() {
    const content = input.value.trim();
    const session = active.value;
    if (!content || !session || streaming.value || busy.value || loading.value)
      return;
    error.value = "";
    input.value = "";
    streaming.value = true;
    const current = ++streamId;
    const assistantId = `stream-${current}-${Date.now()}`;
    const valid = () =>
      !disposed && current === streamId && active.value?.id === session.id;
    session.messages.push({
      id: `user-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    });
    controller = streamEndpoint(
      `/api/conversations/${session.id}/stream`,
      { content },
      {
        onChunk(text) {
          if (!valid()) return;
          const last = session.messages[session.messages.length - 1];
          if (last?.id === assistantId) last.content += text;
          else
            session.messages.push({
              id: assistantId,
              role: "assistant",
              content: text,
              createdAt: new Date().toISOString(),
            });
        },
        onDone() {
          if (!valid()) return;
          streaming.value = false;
          controller = null;
          // Do not reload the active session here: a slow response could erase the next send.
          void getConversations()
            .then((items) => {
              if (valid()) conversations.value = items;
            })
            .catch(() => {});
        },
        onError(cause) {
          if (!valid()) return;
          streaming.value = false;
          controller = null;
          error.value = cause.message;
          ElMessage.error(cause.message);
        },
      },
    );
  }
  watch(() => route.query.conversationId, load, { immediate: true });
  onBeforeUnmount(() => {
    disposed = true;
    ++loadId;
    ++listId;
    stop();
  });
  return {
    conversations,
    active,
    model,
    input,
    loading,
    busy,
    streaming,
    error,
    load,
    open,
    newChat,
    changeModel,
    remove,
    send,
    stop,
  };
}
