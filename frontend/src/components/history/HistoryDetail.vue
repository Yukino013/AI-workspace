<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import type { HistoryItem } from "@/types";
import { md } from "@/utils/markdown";
import { copyText } from "@/utils/clipboard";
import { downloadHistory } from "@/utils/history-export";
const props = defineProps<{ item: HistoryItem | null; modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const router = useRouter();
const html = computed(() => md.render(props.item?.output || ""));
async function copy(value: string) {
  try {
    await copyText(value);
    ElMessage.success("已复制");
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : "复制失败");
  }
}
function reuse() {
  const item = props.item;
  if (!item) return;
  if (item.type === "chat" && item.conversationId) {
    emit("update:modelValue", false);
    router.push({
      path: "/chat",
      query: { conversationId: item.conversationId },
    });
  } else if (item.toolKey) {
    try {
      sessionStorage.setItem(
        "ai-workbench:code-tool-draft",
        JSON.stringify({
          toolKey: item.toolKey,
          model: item.model,
          code: item.input,
          language: item.language || "",
        }),
      );
    } catch {
      ElMessage.error("浏览器无法保存草稿，请复制输入后重试");
      return;
    }
    emit("update:modelValue", false);
    router.push("/code-tools");
  }
}
</script>
<template>
  <el-dialog
    :model-value="modelValue"
    :title="item?.title || '记录详情'"
    width="860px"
    destroy-on-close
    @update:model-value="$emit('update:modelValue', $event)"
    ><template v-if="item"
      ><div class="detail-meta">
        <el-tag effect="plain">{{
          item.type === "chat" ? "AI 对话" : "代码工具"
        }}</el-tag
        ><span>{{ item.model }}</span
        ><span>{{ new Date(item.createdAt).toLocaleString() }}</span>
      </div>
      <el-alert
        v-if="item.status === 'error'"
        :title="item.errorMessage || '本次调用失败'"
        type="error"
        :closable="false" />
      <header class="section-title">
        <h3>输入</h3>
        <el-button link type="primary" @click="copy(item.input)"
          >复制输入</el-button
        >
      </header>
      <pre class="record-input">{{ item.input || "无输入" }}</pre>
      <header class="section-title">
        <h3>输出</h3>
        <el-button
          :disabled="!item.output"
          link
          type="primary"
          @click="copy(item.output)"
          >复制结果</el-button
        >
      </header>
      <div
        v-if="item.output"
        class="markdown-body record-output"
        v-html="html" />
      <el-empty
        v-else
        description="此记录没有生成结果"
        :image-size="55" /></template
    ><template #footer
      ><div v-if="item" class="detail-actions">
        <el-button @click="downloadHistory(item)">导出 Markdown</el-button
        ><el-button
          v-if="item.conversationId || item.toolKey"
          type="primary"
          @click="reuse"
          >{{ item.type === "chat" ? "继续对话" : "再次运行" }}</el-button
        >
      </div></template
    ></el-dialog
  >
</template>
<style scoped>
.detail-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  color: var(--app-muted);
  font-size: 12px;
}
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20px;
}
.section-title h3 {
  font-size: 14px;
}
.record-input {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 260px;
  overflow: auto;
  background: var(--app-surface);
  border-radius: 8px;
  padding: 16px;
  line-height: 1.7;
  font-size: 13px;
}
.record-output {
  max-height: 420px;
  overflow: auto;
}
.detail-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
