<script setup lang="ts">
const props = defineProps<{
  variables: string[];
  values: Record<string, string>;
}>();

const emit = defineEmits<{
  "update:values": [values: Record<string, string>];
}>();

function update(key: string, v: string) {
  emit("update:values", { ...props.values, [key]: v });
}
</script>

<template>
  <el-form v-if="variables.length" label-position="top">
    <el-form-item v-for="key in variables" :key="key">
      <template #label>
        <span class="var-label">{{ key }}</span>
      </template>
      <el-input :model-value="values[key] ?? ''" :placeholder="`请输入 ${key}`" @update:model-value="(v: string) => update(key, v)" />
    </el-form-item>
  </el-form>
  <div v-else class="empty-vars">
    <span class="empty-text">该 Prompt 未定义变量，可在内容中用 &#123;&#123;变量名&#125;&#125; 声明</span>
  </div>
</template>

<style scoped>
.var-label {
  display: inline-block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  color: var(--tech-cyan);
  background: rgba(6, 182, 212, 0.12);
  border-radius: 4px;
  padding: 2px 8px;
}
.empty-vars {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1px dashed var(--el-border-color);
  border-radius: 8px;
  color: var(--app-muted);
  font-size: 13px;
}
.empty-icon {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 14px;
  color: var(--tech-cyan);
}
</style>
