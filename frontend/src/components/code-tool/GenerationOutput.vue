<script setup lang="ts">
import { computed } from "vue";
import { ElMessage } from "element-plus";
import BrandMark from "@/components/common/BrandMark.vue";
import AppIcon from "@/components/common/AppIcon.vue";
import { copyText } from "@/utils/clipboard";
import { md } from "@/utils/markdown";
const props = defineProps<{
  output: string;
  running: boolean;
  error: string;
  stopped: boolean;
}>();
const html = computed(() => md.render(props.output));
async function copy() {
  try {
    await copyText(props.output);
    ElMessage.success("结果已复制");
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : "复制失败");
  }
}
</script>
<template>
  <section class="generation-output" :aria-busy="running">
    <header>
      <span>处理结果 <i v-if="running" class="stream-dot" /></span
      ><el-button v-if="output" link type="primary" @click="copy"
        >复制结果</el-button
      >
    </header>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
    />
    <div v-if="output" class="markdown-body result" v-html="html" />
    <div v-else class="output-empty">
      <span class="output-symbol"><BrandMark :size="38" /></span>
      <h3>{{ running ? "正在处理你的代码" : "更好的代码，从这里开始" }}</h3>
      <p>
        {{
          running
            ? "结果将实时显示，请稍候…"
            : "选择场景并运行，AI 的建议会显示在这里。"
        }}
      </p>
    </div>
    <footer role="status">
      {{
        running
          ? "正在生成…"
          : error
            ? "生成失败，可修改输入后重试"
            : stopped
              ? "已停止 · 当前结果可能不完整"
              : output
                ? "生成完成 · 已保存至历史记录"
                : "AI 输出仅供参考，请在使用前验证"
      }}
    </footer>
  </section>
</template>
<style scoped>
.generation-output {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-light);
  border-radius: 16px;
  background: var(--app-bg);
  overflow: hidden;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  min-height: 65px;
  border-bottom: 1px solid var(--el-border-color-light);
  font-size: 13px;
  font-weight: 600;
}
.result {
  padding: 6px 22px 20px;
  flex: 1;
  max-height: 570px;
  overflow: auto;
}
.output-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  flex: 1;
  padding: 65px 22px;
  text-align: center;
}
.output-symbol {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  padding: 18px;
  border-radius: 20px;
}
.output-empty h3 {
  font-size: 15px;
  margin-top: 22px;
}
.output-empty p {
  font-size: 12px;
  color: var(--app-muted);
  line-height: 1.7;
}
footer {
  font-size: 11px;
  color: var(--app-muted);
  border-top: 1px solid var(--el-border-color-light);
  padding: 18px 20px;
}
.stream-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  margin-left: 8px;
}
</style>
