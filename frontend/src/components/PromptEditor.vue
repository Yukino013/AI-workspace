<script setup lang="ts">
import { computed, ref } from 'vue';

const content = defineModel<string>({ default: '' });

const textareaRef = ref<HTMLTextAreaElement | null>(null);
const highlightRef = ref<HTMLElement | null>(null);

const placeholder = `输入 Prompt 内容，用 {{变量名}} 定义变量，例如：\n请分析下面的代码：\n{{code}}`;

/** 转义 HTML，避免 v-html 注入 */
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * 高亮后的 HTML：把 {{变量}} 拆成「括号（灰）+ 变量名（青）」token。
 * 拆分时用 match.slice 保留原始空格，确保与 textarea 逐字符对齐。
 * 变量名规则与后端 extractVariables 的 VAR_REG 一致。
 */
const highlighted = computed(() => {
  const escaped = escapeHtml(content.value);
  const withVars = escaped.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) => {
    const nameIndex = match.indexOf(name);
    const open = match.slice(0, nameIndex);
    const close = match.slice(nameIndex + name.length);
    return (
      `<span class="brace">${open}</span>` +
      `<span class="name">${name}</span>` +
      `<span class="brace">${close}</span>`
    );
  });
  // 末尾补一个换行，保证最后一行滚动时高亮层高度足够
  return withVars + '\n';
});

function syncScroll() {
  if (textareaRef.value && highlightRef.value) {
    highlightRef.value.scrollTop = textareaRef.value.scrollTop;
    highlightRef.value.scrollLeft = textareaRef.value.scrollLeft;
  }
}
</script>

<template>
  <div class="editor-wrap">
    <pre ref="highlightRef" class="highlight" aria-hidden="true"><code v-html="highlighted"></code></pre>
    <textarea
      ref="textareaRef"
      v-model="content"
      class="textarea"
      :placeholder="placeholder"
      wrap="soft"
      spellcheck="false"
      @scroll="syncScroll"
    ></textarea>
  </div>
</template>

<style scoped>
.editor-wrap {
  position: relative;
  height: 360px;
  border: 1px solid var(--code-border);
  border-radius: 8px;
  background: var(--code-bg);
  overflow: hidden;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.editor-wrap:focus-within {
  border-color: var(--code-accent);
  box-shadow: 0 0 0 1px rgba(34, 211, 238, 0.3);
}
.highlight,
.textarea {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 14px 16px;
  box-sizing: border-box;
  border: none;
  font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: break-word;
}
.highlight {
  pointer-events: none;
  overflow: hidden;
  color: var(--code-text);
  background: transparent;
}
.highlight code {
  font: inherit;
  color: inherit;
  background: transparent;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
}
.textarea {
  color: transparent;
  caret-color: var(--code-accent);
  background: transparent;
  resize: none;
  outline: none;
  overflow: auto;
}
.textarea::placeholder {
  color: var(--code-placeholder);
}
.brace {
  color: var(--code-muted);
}
.name {
  color: var(--code-accent);
  background: var(--code-accent-bg);
  border-radius: 3px;
}
</style>
