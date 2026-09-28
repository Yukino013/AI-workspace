<script setup lang="ts">
defineProps<{ message: string }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div class="load-error" role="alert">
    <span>{{ message }}</span
    ><el-button size="small" @click="$emit('retry')">重新加载</el-button>
  </div>
</template>
<style scoped>
.load-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--el-color-danger-light-7);
  background: var(--el-color-danger-light-9);
  padding: 14px 18px;
  border-radius: 10px;
  color: var(--el-color-danger);
  font-size: 13px;
  margin-bottom: 18px;
}
</style>
