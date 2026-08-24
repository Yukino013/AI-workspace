<script setup lang="ts">
import FeaturePlaceholder from '@/components/common/FeaturePlaceholder.vue';

const items = [
  '后续接入 Conversation / ChatMessage 模型',
  '发送消息时携带会话上下文',
  '流式输出复用 fetch + ReadableStream 消费方式',
];
</script>

<template>
  <FeaturePlaceholder
    title="AI 对话"
    subtitle="统一聊天入口，用于多 Provider、多模型、多轮上下文对话。"
    :items="items"
  />
</template>
