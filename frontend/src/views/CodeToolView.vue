<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import { ElMessage } from "element-plus";
import { getCodeTools } from "@/api/code-tool";
import { MODEL_OPTIONS } from "@/utils/constants";
import { useGeneration } from "@/composables/useGeneration";
import PageHeading from "@/components/common/PageHeading.vue";
import LoadError from "@/components/common/LoadError.vue";
import ToolPicker from "@/components/code-tool/ToolPicker.vue";
import CodeInputPanel from "@/components/code-tool/CodeInputPanel.vue";
import GenerationOutput from "@/components/code-tool/GenerationOutput.vue";
import type { CodeTool } from "@/types";
import type { CodeToolRunContext } from "@/utils/code-tool-export";
const tools = shallowRef<CodeTool[]>([]);
const selected = shallowRef("explain");
const model = shallowRef<string>(MODEL_OPTIONS[0].value);
const code = shallowRef("");
const language = shallowRef("");
const loading = shallowRef(false);
const loadError = shallowRef("");
const runContext = shallowRef<CodeToolRunContext>({
  title: "代码工具报告", model: "", input: "", language: "", createdAt: "",
});
const { output, reasoning, running, error, stopped, start, stop } = useGeneration();
const activeTool = computed(() =>
  tools.value.find((item) => item.key === selected.value),
);
function run() {
  if (!code.value.trim() || running.value || !activeTool.value) return;
  if (selected.value === "translate" && !language.value.trim()) {
    ElMessage.warning("请填写翻译后的目标语言");
    return;
  }
  runContext.value = {
    title: activeTool.value.name,
    model: model.value,
    input: code.value,
    language: language.value.trim(),
    createdAt: new Date().toISOString(),
  };
  start(`/api/code-tools/${selected.value}/stream`, {
    model: model.value,
    code: code.value,
    language: language.value.trim() || undefined,
  });
}
async function load() {
  loading.value = true;
  loadError.value = "";
  try {
    tools.value = await getCodeTools();
    const raw = sessionStorage.getItem("ai-workbench:code-tool-draft");
    if (raw) {
      sessionStorage.removeItem("ai-workbench:code-tool-draft");
      try {
        const draft = JSON.parse(raw);
        if (tools.value.some((tool) => tool.key === draft?.toolKey))
          selected.value = draft.toolKey;
        if (MODEL_OPTIONS.some((option) => option.value === draft?.model))
          model.value = draft.model;
        if (typeof draft?.code === "string") code.value = draft.code;
        if (typeof draft?.language === "string")
          language.value = draft.language;
      } catch {
        ElMessage.warning("历史代码草稿读取失败");
      }
    }
  } catch {
    loadError.value = "代码工具加载失败，请重试。";
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>
<template>
  <div v-loading="loading">
    <PageHeading
      eyebrow="YOUR CODING COMPANION"
      title="专注逻辑，其余交给 AI"
      description="解释、翻译、重构、审查与测试，让重复的开发工作更简单。"
      ><el-select
        v-model="model"
        :disabled="running"
        aria-label="AI 模型"
        style="width: 200px"
        ><el-option
          v-for="option in MODEL_OPTIONS"
          :key="option.value"
          v-bind="option" /></el-select></PageHeading
    ><LoadError
      v-if="loadError"
      :message="loadError"
      @retry="load"
    /><ToolPicker v-model="selected" :tools="tools" :disabled="running" />
    <div class="work-grid">
      <CodeInputPanel
        v-model:code="code"
        v-model:language="language"
        :hint="activeTool?.inputHint || '在这里粘贴需要处理的代码…'"
        :running="running"
        :ready="!!activeTool"
        @run="run"
        @stop="stop"
      /><GenerationOutput
        :output="output"
        :reasoning="reasoning"
        :running="running"
        :error="error"
        :stopped="stopped"
        :context="runContext"
      />
    </div>
  </div>
</template>
<style scoped>
.work-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
@media (max-width: 1100px) {
  .work-grid {
    grid-template-columns: 1fr;
  }
}
</style>
