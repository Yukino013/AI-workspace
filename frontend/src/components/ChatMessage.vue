<script setup lang="ts">
import { computed } from "vue";
import BrandMark from "@/components/common/BrandMark.vue";
import { md } from "@/utils/markdown";

const props = defineProps<{
  role: "user" | "assistant";
  content: string;
}>();

const html = computed(() => md.render(props.content));
</script>

<template>
  <div class="chat-message" :class="`is-${role}`">
    <div v-if="role === 'assistant'" class="avatar" aria-label="AI 回复">
      <BrandMark :size="27" />
    </div>
    <div class="bubble">
      <pre v-if="role === 'user'" class="plain">{{ content }}</pre>
      <div v-else class="markdown-body" v-html="html"></div>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  display: flex;
  gap: 14px;
  margin-bottom: 30px;
}
.avatar {
  flex-shrink: 0;
  padding-top: 3px;
  color: var(--el-color-primary);
}
.bubble {
  flex: 1;
  min-width: 0;
  line-height: 1.85;
  font-size: 14px;
  overflow-wrap: anywhere;
}
.is-user {
  justify-content: flex-end;
}
.is-user .bubble {
  flex: 0 1 auto;
  max-width: 85%;
  padding: 12px 18px;
  background: var(--app-surface);
  border-radius: 18px 18px 4px 18px;
}
.plain {
  margin: 0;
  white-space: pre-wrap;
  font: inherit;
}
.markdown-body :deep(> :first-child) {
  margin-top: 0;
}
@media (max-width: 600px) {
  .chat-message {
    gap: 9px;
  }
  .bubble {
    font-size: 13px;
  }
  .is-user .bubble {
    max-width: 92%;
  }
}
</style>
