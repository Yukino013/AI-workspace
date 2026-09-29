<script setup lang="ts">
import { ElMessage } from "element-plus";
import AppIcon from "@/components/common/AppIcon.vue";
import { copyText } from "@/utils/clipboard";
import { downloadCodeToolReport, type CodeToolReport } from "@/utils/code-tool-export";

const props = defineProps<{ report: CodeToolReport }>();

async function copy(value: string) {
  try {
    await copyText(value);
    ElMessage.success("已复制");
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : "复制失败");
  }
}

function download() {
  try {
    downloadCodeToolReport(props.report);
  } catch {
    ElMessage.error("报告导出失败，请重试");
  }
}
</script>

<template>
  <div class="generation-actions" aria-label="结果操作">
    <el-tooltip v-if="report.reasoning" content="复制推理摘要" placement="top">
      <button class="result-action" type="button" aria-label="复制推理摘要" @click="copy(report.reasoning)">
        <AppIcon name="book" :size="16" />
      </button>
    </el-tooltip>
    <el-tooltip v-if="report.output" content="复制结果" placement="top">
      <button class="result-action" type="button" aria-label="复制结果" @click="copy(report.output)">
        <AppIcon name="copy" :size="16" />
      </button>
    </el-tooltip>
    <el-tooltip v-if="report.output || report.reasoning || report.error" :content="report.running ? '导出当前快照' : '导出 Markdown 报告'" placement="top">
      <button class="result-action" type="button" aria-label="导出 Markdown 报告" @click="download">
        <AppIcon name="archive" :size="16" />
      </button>
    </el-tooltip>
  </div>
</template>

<style scoped>
.generation-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}
.result-action {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--app-muted);
  cursor: pointer;
}
.result-action:hover {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.result-action:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
@media (max-width: 760px) {
  .result-action { width: 44px; height: 44px; }
}
</style>
