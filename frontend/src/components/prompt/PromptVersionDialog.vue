<script setup lang="ts">
import type { PromptVersion } from '@/types';

defineProps<{
  modelValue: boolean;
  versions: PromptVersion[];
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  restore: [version: PromptVersion];
}>();
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    title="历史版本"
    width="600"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <el-table :data="versions" empty-text="暂无历史版本">
      <el-table-column label="版本" width="80">
        <template #default="{ row }">v{{ row.version }}</template>
      </el-table-column>
      <el-table-column label="创建时间" width="180" prop="createdAt" />
      <el-table-column label="操作" width="100" align="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="emit('restore', row)">恢复</el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>
