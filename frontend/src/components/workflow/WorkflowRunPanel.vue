<script setup lang="ts">
import { computed } from 'vue';
import type { Workflow, WorkflowRun } from '@/types';
import AppIcon from '@/components/common/AppIcon.vue';

const props = defineProps<{
  workflow: Workflow | null;
  run: WorkflowRun | null;
  runs: WorkflowRun[];
  running: boolean;
  saving: boolean;
  readyToRun: boolean;
}>();
const inputs = defineModel<Record<string, string>>('inputs', { required: true });
const emit = defineEmits<{
  run: [];
  cancel: [];
  retry: [];
  selectRun: [run: WorkflowRun];
}>();

const inputKeys = computed(() => [
  ...new Set(
    (props.workflow?.steps ?? []).flatMap((step) =>
      Object.values(step.bindings)
        .map((source) => /^input\.([A-Za-z0-9_]+)$/.exec(source)?.[1])
        .filter((key): key is string => Boolean(key)),
    ),
  ),
]);
const canRun = computed(() => inputKeys.value.every((key) => inputs.value[key]?.trim()));
const failedStep = computed(() => props.run?.steps.find((step) => step.status === 'error'));
const statusLabel: Record<WorkflowRun['status'], string> = {
  running: '运行中',
  success: '已完成',
  error: '执行失败',
  aborted: '已停止',
};
</script>

<template>
  <aside class="run-panel" aria-label="工作流运行与记录">
    <section class="run-card">
      <div class="panel-heading">
        <div><p class="section-kicker">02 — RUN</p><h2>运行工作流</h2></div>
        <span v-if="workflow" class="version-badge">v{{ workflow.version }}</span>
      </div>
      <template v-if="workflow">
        <p v-if="!readyToRun" class="unsaved-note">先保存修改，再运行最新版本。</p>
        <p class="helper">为流程填写输入。前序步骤的生成结果会自动传递到已绑定的后续步骤。</p>
        <div v-if="inputKeys.length" class="run-inputs">
          <label v-for="key in inputKeys" :key="key" class="input-field">
            <span>{{ key }}</span>
            <textarea v-model="inputs[key]" :placeholder="`输入 ${key}`" rows="3" :disabled="running" />
          </label>
        </div>
        <p v-else class="no-inputs">这个工作流没有外部输入，可以直接运行。</p>
        <button
          v-if="running"
          class="stop-button"
          type="button"
          aria-label="停止工作流"
          @click="emit('cancel')"
        >
          <span class="stop-square" /> 停止运行
        </button>
        <button
          v-else
          class="run-button"
          type="button"
          :disabled="saving || !readyToRun || !workflow.steps.length || !canRun"
          @click="emit('run')"
        >
          <AppIcon name="play" :size="16" /> 运行工作流
        </button>
      </template>
      <p v-else class="no-inputs">保存工作流后即可输入变量并运行。</p>
    </section>

    <section v-if="run" class="current-run">
      <div class="run-title">
        <h3>本次执行</h3>
        <span class="run-status" :class="`status-${run.status}`">{{ statusLabel[run.status] }}</span>
      </div>
      <ol class="run-steps">
        <li v-for="(step, index) in run.steps" :key="step.stepId" class="run-step">
          <span class="step-marker" :class="`status-${step.status}`">
            <AppIcon v-if="step.status === 'success'" name="check" :size="13" />
            <span v-else>{{ index + 1 }}</span>
          </span>
          <div class="step-result">
            <div class="step-meta">
              <strong>{{ step.promptName }}</strong>
              <span>{{ step.status === 'running' ? '生成中…' : step.status === 'pending' ? '等待中' : step.status === 'success' ? `${step.duration} ms · ${step.tokenUsage.totalTokens ? `${step.tokenUsage.totalTokens} tokens` : '用量未知'}` : step.status === 'aborted' ? '已停止' : '失败' }}</span>
            </div>
            <pre v-if="step.output">{{ step.output }}</pre>
            <p v-if="step.errorMessage" class="step-error">{{ step.errorMessage }}</p>
          </div>
        </li>
      </ol>
      <button v-if="run.status === 'error' && failedStep && !running" class="retry-button" type="button" @click="emit('retry')">
        仅重试失败步骤
      </button>
    </section>

    <section class="history-card">
      <div class="history-heading"><h3>最近运行</h3><span>{{ runs.length }}</span></div>
      <p v-if="!runs.length" class="history-empty">运行完成后会保存在这里。</p>
      <ul v-else class="run-history">
        <li v-for="item in runs" :key="item.id">
          <button
            type="button"
            class="history-item"
            :aria-current="run?.id === item.id ? 'true' : undefined"
            @click="emit('selectRun', item)"
          >
            <span class="history-status" :class="`status-${item.status}`" />
            <span class="history-copy">
              <strong>{{ item.workflowName }} · v{{ item.workflowVersion }}</strong>
              <small>{{ new Date(item.createdAt).toLocaleString() }}</small>
            </span>
            <span class="history-label">{{ statusLabel[item.status] }}</span>
          </button>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.run-panel { display: grid; align-content: start; gap: 14px; min-width: 0; }
.run-card, .current-run, .history-card { min-width: 0; padding: 20px; border: 1px solid var(--el-border-color); border-radius: 16px; background: var(--app-bg); color: var(--app-text); box-shadow: var(--app-shadow); }
.panel-heading, .run-title, .history-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.section-kicker { margin: 0 0 7px; color: var(--el-color-primary); font-size: 10px; font-weight: 700; letter-spacing: 1.2px; }
h2, h3 { margin: 0; font-size: 17px; }
.version-badge { padding: 4px 8px; border-radius: 20px; background: var(--app-hover); color: var(--app-muted); font-size: 11px; }
.helper, .no-inputs { margin: 12px 0 16px; color: var(--app-muted); font-size: 12px; line-height: 1.6; }
.unsaved-note { margin: 10px 0 0; color: var(--el-color-warning); font-size: 11px; }
.run-inputs { display: grid; gap: 12px; }
.input-field { display: grid; gap: 6px; font-size: 12px; font-weight: 600; }
.input-field textarea { box-sizing: border-box; width: 100%; min-height: 72px; resize: vertical; padding: 10px; border: 1px solid var(--el-border-color); border-radius: 9px; background: var(--app-bg); color: var(--app-text); font: inherit; font-size: 13px; line-height: 1.5; }
.input-field textarea:focus-visible, button:focus-visible { outline: 3px solid var(--el-color-primary-light-5); outline-offset: 2px; }
.run-button, .stop-button { display: inline-flex; width: 100%; min-height: 44px; align-items: center; justify-content: center; gap: 8px; margin-top: 16px; border: 0; border-radius: 10px; color: white; font: inherit; font-weight: 600; cursor: pointer; }
.run-button { background: var(--el-color-primary); }
.run-button:disabled { opacity: .5; cursor: not-allowed; }
.stop-button { background: var(--el-color-danger); }
.stop-square { width: 10px; height: 10px; border-radius: 2px; background: currentColor; }
.current-run { padding-bottom: 18px; }
.run-title { margin-bottom: 14px; }
.run-status, .history-label { font-size: 11px; color: var(--app-muted); }
.status-success { color: var(--el-color-success); }
.status-error { color: var(--el-color-danger); }
.status-running { color: var(--el-color-primary); }
.status-aborted { color: var(--app-muted); }
.run-steps { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.run-step { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 9px; padding: 10px 0; border-top: 1px solid var(--el-border-color); }
.step-marker { display: grid; width: 24px; height: 24px; place-items: center; border: 1px solid var(--el-border-color); border-radius: 50%; color: var(--app-muted); font-size: 11px; }
.step-marker.status-success { border-color: var(--el-color-success); background: var(--el-color-success-light-9); color: var(--el-color-success); }
.step-marker.status-running { border-color: var(--el-color-primary-light-5); background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.step-marker.status-error { border-color: var(--el-color-danger-light-5); background: var(--el-color-danger-light-9); color: var(--el-color-danger); }
.step-meta { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px; font-size: 12px; }
.step-meta span { color: var(--app-muted); font-size: 10px; }
.step-result pre { max-height: 190px; overflow: auto; margin: 8px 0 0; padding: 10px; border-radius: 8px; background: var(--app-hover); color: var(--app-text); font-family: var(--el-font-family); font-size: 11px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.step-error { margin: 8px 0 0; color: var(--el-color-danger); font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.retry-button { width: 100%; min-height: 40px; margin-top: 12px; border: 1px solid var(--el-color-primary-light-5); border-radius: 9px; background: transparent; color: var(--el-color-primary); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.history-heading h3 { font-size: 15px; }
.history-heading span { color: var(--app-muted); font-size: 11px; }
.history-empty { margin: 12px 0 0; color: var(--app-muted); font-size: 12px; }
.run-history { display: grid; gap: 4px; margin: 12px 0 0; padding: 0; list-style: none; }
.history-item { display: flex; width: 100%; min-height: 54px; align-items: center; gap: 9px; padding: 7px 6px; border: 0; border-radius: 8px; background: transparent; color: inherit; text-align: left; cursor: pointer; }
.history-item:hover, .history-item[aria-current="true"] { background: var(--app-hover); }
.history-status { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; background: var(--app-muted); }
.history-status.status-success { background: var(--el-color-success); }
.history-status.status-error { background: var(--el-color-danger); }
.history-status.status-running { background: var(--el-color-primary); }
.history-copy { display: grid; min-width: 0; flex: 1; gap: 3px; }
.history-copy strong { overflow: hidden; font-size: 11px; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
.history-copy small { color: var(--app-muted); font-size: 10px; }
.history-label { white-space: nowrap; }
</style>
