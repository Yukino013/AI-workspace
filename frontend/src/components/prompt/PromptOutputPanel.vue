<script setup lang="ts">
import ChatMessage from '@/components/ChatMessage.vue';

defineProps<{
  output: string;
  streaming: boolean;
}>();
</script>

<template>
  <el-card shadow="never" class="panel-right">
    <template #header>
      <div class="panel-header">
        <div class="panel-title">
          <span class="title-text">AI 输出</span>
          <span v-if="streaming" class="streaming-badge">
            <span class="dot"></span>
            生成中
          </span>
        </div>
      </div>
    </template>

    <div class="output">
      <ChatMessage v-if="output" role="assistant" :content="output" />
      <div v-else class="empty">
        <div class="empty-mark">AI</div>
        <p class="empty-title">等待运行</p>
        <p class="empty-desc">在左侧填写变量后点击「运行」，AI 输出将在这里实时呈现</p>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
.panel-right {
  border: 1px solid var(--el-border-color-light);
  background: var(--app-bg);
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 12px;
}
.title-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--app-text);
}
.title-text::before {
  content: '>_ ';
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--tech-cyan);
  font-weight: 400;
}
.streaming-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--tech-cyan);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tech-cyan);
  animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.7);
  }
}
.output {
  min-height: 320px;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  text-align: center;
  color: var(--app-muted);
}
.empty-mark {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, var(--tech-violet), var(--tech-cyan));
  opacity: 0.9;
  margin-bottom: 16px;
}
.empty-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--app-text);
}
.empty-desc {
  margin: 0;
  font-size: 13px;
  max-width: 280px;
  line-height: 1.6;
}
</style>
