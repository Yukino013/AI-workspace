<script setup lang="ts">
import FeaturePlaceholder from '@/components/common/FeaturePlaceholder.vue';

const items = [
  '后续接入 explain / translate / refactor / review / test 场景',
  '支持粘贴代码后直接生成场景化 Prompt',
  '结果可写入代码工具历史记录，再统一检索',
];
</script>

<template>
  <FeaturePlaceholder
    title="代码工具"
    subtitle="基于固定场景模板的代码解释与改写入口。"
    :items="items"
  />
</template>
