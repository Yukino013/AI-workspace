<script setup lang="ts">
import FeaturePlaceholder from '@/components/common/FeaturePlaceholder.vue';

const items = [
  '后续聚合对话会话与代码工具结果',
  '支持关键词搜索和来源筛选',
  '提供继续对话、复制结果、再次运行等复用动作',
];
</script>

<template>
  <FeaturePlaceholder
    title="历史记录"
    subtitle="统一检索对话与代码工具记录。"
    :items="items"
  />
</template>
