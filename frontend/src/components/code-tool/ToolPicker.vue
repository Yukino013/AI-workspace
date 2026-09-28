<script setup lang="ts">
import AppIcon from "@/components/common/AppIcon.vue";
import type { CodeTool } from "@/types";
defineProps<{ tools: CodeTool[]; modelValue: string; disabled: boolean }>();
defineEmits<{ "update:modelValue": [value: string] }>();
</script>
<template>
  <div class="tool-picker" role="group" aria-label="代码处理场景">
    <button
      v-for="tool in tools"
      :key="tool.key"
      :disabled="disabled"
      :aria-pressed="modelValue === tool.key"
      :class="{ active: modelValue === tool.key }"
      @click="$emit('update:modelValue', tool.key)"
    >
      <AppIcon :name="tool.key === 'refactor' ? 'wand' : 'code'" /><strong>{{
        tool.name
      }}</strong
      ><span>{{ tool.description }}</span>
    </button>
  </div>
</template>
<style scoped>
.tool-picker {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.tool-picker button {
  position: relative;
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 10px;
  text-align: left;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  padding: 20px 16px;
  background: var(--app-bg);
  color: var(--app-muted);
  transition:
    background 0.2s,
    border-color 0.2s;
}
.tool-picker button.active {
  border-color: var(--el-color-primary-light-5);
  box-shadow: inset 0 3px 0 var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.tool-picker button:hover:not(:disabled) {
  border-color: var(--el-color-primary-light-5);
}
.tool-picker strong {
  color: var(--app-text);
  font-size: 13px;
  font-weight: 550;
}
.tool-picker button > span:last-child {
  font-size: 11px;
  line-height: 1.6;
}
.tool-picker .app-icon {
  color: var(--el-color-primary);
}
@media (max-width: 500px) {
  .tool-picker {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
