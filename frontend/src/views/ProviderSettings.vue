<script setup lang="ts">
import FeaturePlaceholder from '@/components/common/FeaturePlaceholder.vue';

const items = [
  '后续接入 AIProvider 模型与 CRUD 接口',
  'API Key 只提交到后端，前端仅展示脱敏值',
  '模型列表来自启用的 Provider 配置',
];
</script>

<template>
  <FeaturePlaceholder
    title="Provider 配置"
    subtitle="用于维护 DeepSeek、Qwen、OpenAI 兼容服务和自定义模型。"
    :items="items"
  />
</template>
