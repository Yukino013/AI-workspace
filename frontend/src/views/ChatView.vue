<script setup lang="ts">
import { nextTick, shallowRef, watch } from "vue";
import { ElScrollbar } from "element-plus";
import { useConversations } from "@/composables/useConversations";
import ChatWelcome from "@/components/chat/ChatWelcome.vue";
import ChatComposer from "@/components/chat/ChatComposer.vue";
import ChatMessage from "@/components/ChatMessage.vue";
import ConversationSidebar from "@/components/chat/ConversationSidebar.vue";
import AppIcon from "@/components/common/AppIcon.vue";
import LoadError from "@/components/common/LoadError.vue";
const {
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
} = useConversations();
const showSessions = shallowRef(false);
const composer = shallowRef<InstanceType<typeof ChatComposer>>();
async function suggest(text: string) {
  input.value = text;
  await nextTick();
  composer.value?.focus();
}
const scrollbar = shallowRef<InstanceType<typeof ElScrollbar>>();
const followOutput = shallowRef(true);
function onScroll({ scrollTop }: { scrollTop: number }) {
  const wrap = scrollbar.value?.wrapRef;
  if (wrap)
    followOutput.value =
      wrap.scrollHeight - wrap.clientHeight - scrollTop < 100;
}
watch(
  () =>
    active.value?.messages.map((message) => message.content).join("").length,
  async () => {
    if (!followOutput.value) return;
    await nextTick();
    const wrap = scrollbar.value?.wrapRef;
    if (wrap) scrollbar.value?.setScrollTop(wrap.scrollHeight);
  },
);
watch(
  () => active.value?.id,
  () => {
    followOutput.value = true;
  },
);
function onKeydown(event: KeyboardEvent) {
  if (
    event.key !== "Enter" ||
    event.shiftKey ||
    event.isComposing ||
    event.keyCode === 229
  )
    return;
  event.preventDefault();
  followOutput.value = true;
  send();
}
</script>
<template>
  <div class="chat-page">
    <LoadError v-if="error" :message="error" @retry="load" />
    <header class="chat-toolbar">
      <div class="chat-title">
        <AppIcon name="chat" :size="18" /><span>{{
          active
            ? conversations.find((item) => item.id === active?.id)?.title ||
              active.title
            : "AI 对话"
        }}</span>
      </div>
      <div class="chat-tools">
        <button
          class="session-toggle"
          :class="{ selected: showSessions }"
          :aria-expanded="showSessions"
          aria-controls="conversation-panel"
          @click="showSessions = !showSessions"
        >
          <AppIcon name="panel" :size="16" /><span>会话记录</span></button
        ><button
          class="icon-button"
          aria-label="新建会话"
          title="新建会话"
          :disabled="busy"
          @click="newChat"
        >
          <AppIcon name="plus" :size="20" />
        </button>
      </div>
    </header>
    <div class="chat-layout" :class="{ 'with-sessions': showSessions }">
      <ConversationSidebar
        v-if="showSessions"
        id="conversation-panel"
        :conversations="conversations"
        :active-id="active?.id"
        :busy="busy"
        @open="open"
        @remove="remove"
        @create="newChat"
      />
      <section
        v-loading="loading"
        class="chat-main"
        :class="{ 'is-empty': !active?.messages.length }"
        aria-label="对话内容"
      >
        <ChatWelcome
          v-if="!active?.messages.length"
          :ready="!!active"
          :busy="busy"
          @create="newChat"
          @suggest="suggest"
        />
        <el-scrollbar v-else ref="scrollbar" class="messages" @scroll="onScroll"
          ><div class="message-column">
            <ChatMessage
              v-for="message in active.messages"
              :key="message.id"
              :role="message.role"
              :content="message.content"
            />
            <div v-if="streaming" class="generating" role="status">
              <span /> 正在思考与生成…
            </div>
          </div></el-scrollbar
        >
        <ChatComposer
          v-if="active"
          ref="composer"
          v-model="input"
          v-model:selected-model="model"
          :streaming="streaming"
          :disabled="busy || loading"
          @send="
            followOutput = true;
            send();
          "
          @stop="stop"
          @change-model="changeModel"
          @keydown="onKeydown"
        />
      </section>
    </div>
  </div>
</template>
<style scoped>
.chat-page {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 120px);
  min-height: 560px;
}
.chat-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  padding: 4px 5px 18px;
}
.chat-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--app-muted);
  font-size: 12px;
}
.chat-title > span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 420px;
}
.chat-title > .app-icon {
  flex-shrink: 0;
}
.chat-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.session-toggle {
  border: 0;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  border-radius: 8px;
  background: transparent;
  color: var(--app-muted);
  font-size: 11px;
}
.session-toggle:hover,
.session-toggle.selected {
  background: var(--app-surface);
  color: var(--el-color-primary);
}
.chat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  flex: 1;
  min-height: 0;
  gap: 24px;
}
.chat-layout.with-sessions {
  grid-template-columns: 225px minmax(0, 1fr);
}
.chat-main {
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px 18px 0;
}
.chat-main.is-empty {
  justify-content: center;
  padding-bottom: min(10vh, 90px);
  overflow: auto;
}
.messages {
  flex: 1;
  min-height: 0;
  margin-bottom: 20px;
}
.message-column {
  max-width: 780px;
  margin: auto;
  padding: 20px 10px 8px;
}
.generating {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--app-muted);
  margin: 20px 0;
}
.generating span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
}
@media (max-width: 1050px) {
  .chat-layout {
    gap: 10px;
  }
  .chat-layout.with-sessions {
    grid-template-columns: 190px minmax(0, 1fr);
  }
  .chat-main {
    padding-inline: 0;
  }
}
@media (max-width: 760px) {
  .chat-page {
    height: calc(100dvh - 88px);
    min-height: 580px;
  }
  .chat-layout.with-sessions {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .chat-main.is-empty {
    padding-bottom: 25px;
  }
  .chat-toolbar {
    padding-bottom: 12px;
  }
  .chat-title > span {
    max-width: 155px;
  }
  .session-toggle {
    min-height: 44px;
  }
  .chat-layout.with-sessions :deep(.sessions) {
    max-height: 185px;
  }
  .chat-layout.with-sessions .chat-main.is-empty {
    justify-content: flex-start;
    padding-top: 18px;
  }
}
</style>
