<script setup lang="ts">
defineProps<{
  code: string;
  language: string;
  hint: string;
  running: boolean;
  ready: boolean;
}>();
defineEmits<{
  "update:code": [value: string];
  "update:language": [value: string];
  run: [];
  stop: [];
}>();
</script>
<template>
  <section class="code-input-panel">
    <header>
      <span>源代码</span
      ><el-input
        :model-value="language"
        :disabled="running"
        aria-label="目标编程语言"
        placeholder="目标语言（翻译时填写）"
        @update:model-value="$emit('update:language', $event)"
      />
    </header>
    <el-input
      :model-value="code"
      :disabled="running"
      aria-label="源代码"
      type="textarea"
      :rows="19"
      resize="none"
      :placeholder="hint"
      @update:model-value="$emit('update:code', $event)"
    />
    <footer>
      <span>{{ code.length.toLocaleString() }} 字符</span
      ><el-button v-if="running" @click="$emit('stop')">停止生成</el-button
      ><el-button
        v-else
        type="primary"
        :disabled="!code.trim() || !ready"
        @click="$emit('run')"
        >运行工具</el-button
      >
    </footer>
  </section>
</template>
<style scoped>
.code-input-panel {
  background: var(--app-bg);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  overflow: hidden;
  min-width: 0;
}
header,
footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  font-size: 13px;
}
header {
  border-bottom: 1px solid var(--el-border-color-light);
  font-weight: 600;
}
header .el-input {
  width: 210px;
  max-width: 70%;
}
footer span {
  color: var(--app-muted);
  font-size: 11px;
}
.code-input-panel :deep(textarea) {
  border: 0;
  border-radius: 0;
  box-shadow: none !important;
  padding: 20px;
  background: var(--code-bg);
  color: var(--code-text);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 13px;
  line-height: 1.8;
}
.code-input-panel :deep(textarea::placeholder) {
  color: var(--code-placeholder);
}
.code-input-panel :deep(textarea:disabled) {
  background: var(--code-bg);
  color: var(--code-text);
}
</style>
