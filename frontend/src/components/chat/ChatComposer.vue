<script setup lang="ts">
import { shallowRef } from "vue";
import { ElInput } from "element-plus";
import { MODEL_OPTIONS } from "@/utils/constants";
import AppIcon from "@/components/common/AppIcon.vue";
const input = defineModel<string>({ required: true });
const model = defineModel<string>("selectedModel", { required: true });
defineProps<{ streaming: boolean; disabled: boolean }>();
const emit = defineEmits<{
  send: [];
  stop: [];
  changeModel: [];
  keydown: [event: KeyboardEvent];
}>();
const field = shallowRef<InstanceType<typeof ElInput>>();
function onKeydown(event: Event | KeyboardEvent) {
  if (event instanceof KeyboardEvent) emit("keydown", event);
}
defineExpose({ focus: () => field.value?.focus() });
</script>
<template>
  <div class="composer-wrap">
    <div class="composer">
      <el-input
        ref="field"
        v-model="input"
        type="textarea"
        :autosize="{ minRows: 3, maxRows: 7 }"
        resize="none"
        aria-label="聊天消息"
        placeholder="把问题交给 AI，把注意力留给创造…"
        @keydown="onKeydown"
      />
      <div class="composer-bottom">
        <el-select
          v-model="model"
          :disabled="streaming || disabled"
          aria-label="对话模型"
          @change="emit('changeModel')"
          ><el-option
            v-for="option in MODEL_OPTIONS"
            :key="option.value"
            v-bind="option" /></el-select
        ><span class="input-hint">Shift + Enter 换行</span
        ><button
          v-if="streaming"
          class="send-button stop-button"
          aria-label="停止生成"
          title="停止生成"
          @click="emit('stop')"
        >
          <span /></button
        ><button
          v-else
          class="send-button"
          aria-label="发送消息"
          title="发送消息"
          :disabled="!input.trim() || disabled"
          @click="emit('send')"
        >
          <AppIcon name="arrow-up" :size="21" />
        </button>
      </div>
    </div>
    <p class="disclaimer">AI 也会有不确定的时候，重要信息请核实。</p>
  </div>
</template>
<style scoped>
.composer-wrap {
  width: 100%;
  max-width: 780px;
  margin: 0 auto;
}
.composer {
  background: var(--app-surface);
  border: 1px solid var(--app-line);
  border-radius: 22px;
  padding: 18px 18px 12px;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.composer:focus-within {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 25px #4d6bfe08;
}
.composer :deep(.el-textarea__inner) {
  box-shadow: none;
  background: transparent;
  padding: 0 3px;
  font-size: 14px;
  line-height: 1.8;
}
.composer-bottom {
  display: flex;
  gap: 12px;
  align-items: center;
  padding-top: 14px;
}
.el-select {
  width: 175px;
}
.composer :deep(.el-select__wrapper) {
  background: var(--app-bg);
  border: 1px solid var(--app-line);
  box-shadow: none;
  border-radius: 20px;
  min-height: 32px;
  font-size: 11px;
}
.input-hint {
  margin-left: auto;
  color: var(--app-muted);
  font-size: 10px;
}
.send-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border: 0;
  border-radius: 50%;
  background: var(--el-color-primary);
  color: var(--send-fg, #fff);
}
.send-button:disabled {
  background: var(--app-hover);
  color: var(--app-muted);
  cursor: not-allowed;
}
.stop-button span {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  background: currentColor;
}
.disclaimer {
  text-align: center;
  font-size: 10px;
  color: var(--app-muted);
  margin: 13px 0 0;
}
.dark .send-button {
  --send-fg: #171c35;
}
@media (max-width: 600px) {
  .composer :deep(.el-textarea__inner) {
    font-size: 16px;
  }
  .composer {
    padding: 16px 14px 12px;
  }
  .input-hint {
    display: none;
  }
  .send-button {
    margin-left: auto;
    width: 44px;
    height: 44px;
  }
  .composer-bottom {
    gap: 8px;
  }
}
</style>
