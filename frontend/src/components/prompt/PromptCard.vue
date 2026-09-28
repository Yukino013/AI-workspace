<script setup lang="ts">
import AppIcon from "@/components/common/AppIcon.vue";
import type { Prompt } from "@/types";
defineProps<{ prompt: Prompt; updated: string }>();
defineEmits<{ open: []; copy: []; remove: [] }>();
</script>
<template>
  <article class="prompt-card">
    <div class="card-top">
      <span class="prompt-symbol"><AppIcon name="prompt" :size="19" /></span
      ><span class="version">v{{ prompt.currentVersion }}</span>
    </div>
    <button
      class="card-open"
      :aria-label="`编辑 ${prompt.name}`"
      @click="$emit('open')"
    >
      <h3>{{ prompt.name }}</h3>
      <p>{{ prompt.description || "为你的下一个好想法，留一份模板。" }}</p>
      <span class="preview">{{ prompt.content }}</span>
    </button>
    <footer>
      <span>{{ updated }} 更新</span>
      <div>
        <button
          class="icon-button"
          :aria-label="`复制 ${prompt.name}`"
          title="复制模板"
          @click="$emit('copy')"
        >
          <AppIcon name="copy" :size="15" /></button
        ><button
          class="icon-button delete"
          :aria-label="`删除 ${prompt.name}`"
          title="删除 Prompt"
          @click="$emit('remove')"
        >
          <AppIcon name="trash" :size="15" /></button
        ><button
          class="icon-button"
          :aria-label="`打开 ${prompt.name}`"
          title="打开工作台"
          @click="$emit('open')"
        >
          <AppIcon name="arrow-up-right" :size="17" />
        </button>
      </div>
    </footer>
  </article>
</template>
<style scoped>
.prompt-card {
  padding: 21px 22px 12px;
  min-width: 0;
  border: 1px solid var(--app-line);
  border-radius: 15px;
  background: var(--app-bg);
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.prompt-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 8px 22px #24386e06;
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.prompt-symbol {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: var(--app-surface);
  color: var(--app-muted);
}
.version {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--app-muted);
}
.card-open {
  display: block;
  width: 100%;
  text-align: left;
  border: 0;
  padding: 0;
  background: none;
  color: inherit;
}
h3 {
  margin: 18px 0 8px;
  font-size: 15px;
  font-weight: 550;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
p {
  color: var(--app-muted);
  font-size: 12px;
  margin: 0 0 17px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  height: 70px;
  padding: 9px 12px;
  background: var(--app-surface);
  border-radius: 7px;
  font: 11px/1.7 var(--font-mono);
  color: var(--app-muted);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 5px;
  margin-top: 13px;
  color: var(--app-muted);
  font-size: 10px;
}
footer > div {
  display: flex;
}
.icon-button {
  width: 30px;
  height: 32px;
}
.delete:hover {
  color: var(--el-color-danger);
}
</style>
