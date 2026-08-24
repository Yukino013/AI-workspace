<script setup lang="ts">
import { computed } from 'vue';
import { md } from '@/utils/markdown';

const props = defineProps<{
  role: 'user' | 'assistant';
  content: string;
}>();

const html = computed(() => md.render(props.content));
</script>

<template>
  <div class="chat-message" :class="`is-${role}`">
    <div class="avatar">{{ role === 'assistant' ? 'AI' : '用户' }}</div>
    <div class="bubble">
      <pre v-if="role === 'user'" class="plain">{{ content }}</pre>
      <div v-else class="markdown-body" v-html="html"></div>
    </div>
  </div>
</template>

<style scoped>
.chat-message {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}
.avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
  background: var(--el-color-primary);
}
.is-user .avatar {
  background: var(--el-color-success);
}
.bubble {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  line-height: 1.6;
  white-space: normal;
  word-break: break-word;
}
.plain {
  margin: 0;
  white-space: pre-wrap;
  font-family: inherit;
}
</style>
