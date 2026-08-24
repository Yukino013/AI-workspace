import { defineStore } from 'pinia';
import { shallowRef } from 'vue';
import { AI_MODELS } from '@/utils/constants';
import type { Prompt } from '@/types';

/**
 * Prompt 工作台的 UI 状态（当前编辑项 / 选中模型 / 运行态）。
 * 数据读写一律走 api 层请求后端，这里不再维护内存 mock。
 */
export const usePromptStore = defineStore('prompt', () => {
  const current = shallowRef<Prompt | null>(null);
  const model = shallowRef<string>(AI_MODELS.DEEPSEEK);
  const running = shallowRef(false);

  function loadPrompt(prompt: Prompt) {
    current.value = prompt;
  }

  function reset() {
    current.value = null;
    running.value = false;
  }

  return { current, model, running, loadPrompt, reset };
});
