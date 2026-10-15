<script setup lang="ts">
import { computed } from 'vue';
import type { ProviderConfig, Prompt, Workflow } from '@/types';
import AppIcon from '@/components/common/AppIcon.vue';

export type WorkflowDraft = {
  name: string;
  description: string;
  steps: Array<Pick<Workflow['steps'][number], 'id' | 'promptId' | 'model' | 'bindings'>>;
};

const props = defineProps<{
  prompts: Prompt[];
  providers: ProviderConfig[];
  saving: boolean;
  isNew: boolean;
}>();
const draft = defineModel<WorkflowDraft>({ required: true });
const emit = defineEmits<{
  save: [];
  cancel: [];
}>();

const models = computed(() => props.providers);
function modelConfigured(model: string) {
  return props.providers.find((provider) => provider.model === model)?.configured ?? false;
}
function promptFor(id: string) {
  return props.prompts.find((prompt) => prompt.id === id);
}
function addStep() {
  draft.value = {
    ...draft.value,
    steps: [
      ...draft.value.steps,
      {
        id: crypto.randomUUID(),
        promptId: '',
        model: models.value[0]?.model ?? '',
        bindings: {},
      },
    ],
  };
}
function removeStep(index: number) {
  draft.value = { ...draft.value, steps: draft.value.steps.filter((_, stepIndex) => stepIndex !== index) };
}
function selectPrompt(index: number, promptId: string) {
  const prompt = promptFor(promptId);
  draft.value = {
    ...draft.value,
    steps: draft.value.steps.map((step, stepIndex) =>
      stepIndex === index
        ? {
            ...step,
            promptId,
            bindings: Object.fromEntries((prompt?.variables ?? []).map((variable) => [variable, `input.${variable}`])),
          }
        : step,
    ),
  };
}
function setBinding(index: number, variable: string, source: string) {
  draft.value = {
    ...draft.value,
    steps: draft.value.steps.map((step, stepIndex) =>
      stepIndex === index ? { ...step, bindings: { ...step.bindings, [variable]: source } } : step,
    ),
  };
}
function setModel(index: number, model: string) {
  draft.value = {
    ...draft.value,
    steps: draft.value.steps.map((step, stepIndex) => (stepIndex === index ? { ...step, model } : step)),
  };
}
const ready = computed(
  () =>
    Boolean(draft.value.name.trim()) &&
    draft.value.steps.length > 0 &&
    draft.value.steps.every((step, index) => {
      const prompt = promptFor(step.promptId);
      const availableSources = new Set([
        ...draft.value.steps.slice(0, index).map((previous) => `steps.${previous.id}.output`),
        ...(prompt?.variables ?? []).map((variable) => `input.${variable}`),
      ]);
      return Boolean(
        prompt &&
          step.model &&
          prompt.variables.every((variable) => availableSources.has(step.bindings[variable])),
      );
    }),
);
</script>

<template>
  <form class="workflow-editor" @submit.prevent="emit('save')">
    <header class="editor-heading">
      <div>
        <p class="eyebrow">{{ isNew ? 'NEW WORKFLOW' : 'WORKFLOW SETTINGS' }}</p>
        <h1>{{ isNew ? '搭建工作流' : '编辑工作流' }}</h1>
        <p>步骤按顺序运行。每个步骤会使用所选 Prompt 的最新已保存版本。</p>
      </div>
      <button class="text-button" type="button" @click="emit('cancel')">返回列表</button>
    </header>

    <div class="basic-fields">
      <label class="field">
        <span>工作流名称</span>
        <input v-model="draft.name" maxlength="100" placeholder="例如：技术文章初稿" required />
      </label>
      <label class="field">
        <span>用途说明 <small>可选</small></span>
        <textarea v-model="draft.description" maxlength="500" rows="2" placeholder="描述这个流程适合解决什么任务" />
      </label>
    </div>

    <section class="steps-section" aria-labelledby="steps-heading">
      <div class="section-title">
        <div><span class="section-kicker">01 — BUILD THE FLOW</span><h2 id="steps-heading">执行步骤</h2></div>
        <span class="step-limit">{{ draft.steps.length }} / 10</span>
      </div>
      <ol v-if="draft.steps.length" class="step-list">
        <li v-for="(step, index) in draft.steps" :key="step.id" class="step-card">
          <div class="step-index">{{ String(index + 1).padStart(2, '0') }}</div>
          <div class="step-content">
            <div class="step-fields">
              <label class="field">
                <span>选择 Prompt</span>
                <select :value="step.promptId" required @change="selectPrompt(index, ($event.target as HTMLSelectElement).value)">
                  <option value="" disabled>选择一个已保存的 Prompt</option>
                  <option v-for="prompt in prompts" :key="prompt.id" :value="prompt.id">{{ prompt.name }} · v{{ prompt.currentVersion }}</option>
                </select>
              </label>
              <label class="field">
                <span>模型</span>
                <select :value="step.model" required @change="setModel(index, ($event.target as HTMLSelectElement).value)">
                  <option value="" disabled>选择模型</option>
                  <option v-for="provider in models" :key="provider.model" :value="provider.model">
                    {{ provider.name }} · {{ provider.model }}{{ provider.configured ? '' : '（未配置）' }}
                  </option>
                </select>
              </label>
              <button class="remove-step" type="button" :aria-label="`移除第 ${index + 1} 步`" @click="removeStep(index)">
                <AppIcon name="trash" :size="16" />
              </button>
            </div>
            <p v-if="step.model && !modelConfigured(step.model)" class="model-warning">此模型尚未配置 API Key，运行前请到「模型与 API」完成配置。</p>
            <div v-if="promptFor(step.promptId)?.variables.length" class="bindings">
              <p>输入映射 <span>可以引用开始时填写的变量，或任意前序步骤输出</span></p>
              <label v-for="variable in promptFor(step.promptId)?.variables" :key="variable" class="binding-row">
                <code>{{ variable }}</code>
                <span class="binding-arrow">←</span>
                <select
                  :value="step.bindings[variable] ?? ''"
                  :aria-label="`${variable} 的输入来源`"
                  required
                  @change="setBinding(index, variable, ($event.target as HTMLSelectElement).value)"
                >
                  <option :value="`input.${variable}`">运行输入 · {{ variable }}</option>
                  <option
                    v-for="previous in draft.steps.slice(0, index)"
                    :key="previous.id"
                    :value="`steps.${previous.id}.output`"
                  >
                    上一步输出 · {{ promptFor(previous.promptId)?.name || `步骤 ${draft.steps.indexOf(previous) + 1}` }}
                  </option>
                </select>
              </label>
            </div>
            <p v-else-if="step.promptId" class="no-variables">此 Prompt 没有模板变量，内容会直接发送给模型。</p>
          </div>
        </li>
      </ol>
      <div v-else class="no-steps">还没有步骤，添加一个 Prompt 开始搭建。</div>
      <button class="add-step" type="button" :disabled="draft.steps.length >= 10" @click="addStep">
        <AppIcon name="plus" :size="16" /> 添加 Prompt 步骤
      </button>
    </section>

    <div v-if="!prompts.length" class="notice">
      <AppIcon name="prompt" :size="18" />
      <span>先到 Prompt 资源库创建并保存 Prompt，然后再回来编排。</span>
    </div>
    <footer class="editor-actions">
      <button class="text-button" type="button" @click="emit('cancel')">取消</button>
      <button class="primary-button" type="submit" :disabled="saving || !ready || !models.length">
        {{ saving ? '正在保存…' : isNew ? '保存工作流' : '保存修改' }}
      </button>
    </footer>
  </form>
</template>

<style scoped>
.workflow-editor { min-width: 0; padding: clamp(20px, 3vw, 32px); border: 1px solid var(--el-border-color); border-radius: 18px; background: var(--app-bg); color: var(--app-text); box-shadow: var(--app-shadow); }
.editor-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 28px; }
.eyebrow, .section-kicker { margin: 0 0 8px; color: var(--el-color-primary); font-size: 10px; font-weight: 700; letter-spacing: 1.3px; }
h1 { margin: 0; font-size: 27px; letter-spacing: -.7px; }
.editor-heading p:last-child { margin: 8px 0 0; color: var(--app-muted); font-size: 13px; line-height: 1.6; }
.text-button { min-height: 40px; padding: 0 10px; border: 0; background: transparent; color: var(--app-muted); font: inherit; cursor: pointer; }
.text-button:hover { color: var(--el-color-primary); }
.basic-fields { display: grid; gap: 16px; padding: 20px; border-radius: 14px; background: var(--app-hover); }
.field { display: grid; min-width: 0; gap: 7px; color: var(--app-text); font-size: 12px; font-weight: 600; }
.field small { color: var(--app-muted); font-weight: 400; }
.field input, .field textarea, .field select, .binding-row select { width: 100%; min-height: 42px; box-sizing: border-box; padding: 10px 12px; border: 1px solid var(--el-border-color); border-radius: 9px; background: var(--app-bg); color: var(--app-text); font: inherit; font-size: 13px; }
.field textarea { min-height: 68px; resize: vertical; }
.field :focus-visible, .binding-row select:focus-visible, button:focus-visible { outline: 3px solid var(--el-color-primary-light-5); outline-offset: 2px; }
.steps-section { margin-top: 30px; }
.section-title { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 14px; }
.section-title h2 { margin: 0; font-size: 19px; }
.step-limit { color: var(--app-muted); font-size: 12px; }
.step-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.step-card { display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 14px; padding: 16px; border: 1px solid var(--el-border-color); border-radius: 13px; }
.step-index { display: grid; width: 34px; height: 34px; place-items: center; border-radius: 10px; background: var(--app-hover); color: var(--el-color-primary); font-size: 12px; font-weight: 700; }
.step-content { min-width: 0; }
.step-fields { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(140px, 1fr) 36px; align-items: end; gap: 12px; }
.remove-step { display: grid; width: 36px; height: 42px; place-items: center; border: 0; border-radius: 8px; background: transparent; color: var(--app-muted); cursor: pointer; }
.remove-step:hover { background: var(--app-hover); color: var(--el-color-danger); }
.bindings { display: grid; gap: 8px; margin-top: 16px; }
.bindings > p { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; font-size: 12px; font-weight: 600; }
.bindings > p span, .no-variables { color: var(--app-muted); font-weight: 400; }
.binding-row { display: grid; grid-template-columns: minmax(64px, .45fr) 18px minmax(160px, 1fr); align-items: center; gap: 8px; }
.binding-row code { overflow: hidden; color: var(--app-text); font-size: 12px; text-overflow: ellipsis; }
.binding-arrow { color: var(--app-muted); text-align: center; }
.binding-row select { min-height: 38px; padding: 8px; font-size: 12px; }
.no-variables { margin: 14px 0 0; font-size: 12px; }
.model-warning { margin: 12px 0 0; color: var(--el-color-warning); font-size: 11px; line-height: 1.5; }
.no-steps { padding: 28px 16px; border: 1px dashed var(--el-border-color); border-radius: 12px; color: var(--app-muted); text-align: center; font-size: 13px; }
.add-step { display: inline-flex; min-height: 42px; align-items: center; gap: 7px; margin-top: 14px; padding: 0 12px; border: 1px dashed var(--el-border-color); border-radius: 9px; background: transparent; color: var(--el-color-primary); font: inherit; font-size: 13px; cursor: pointer; }
.add-step:disabled { opacity: .5; cursor: not-allowed; }
.notice { display: flex; align-items: flex-start; gap: 10px; margin-top: 18px; padding: 12px; border-radius: 10px; background: var(--app-hover); color: var(--app-muted); font-size: 12px; line-height: 1.5; }
.notice :deep(svg) { flex: 0 0 auto; color: var(--el-color-primary); }
.editor-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 26px; padding-top: 16px; border-top: 1px solid var(--el-border-color); }
.primary-button { min-height: 44px; padding: 0 16px; border: 0; border-radius: 9px; background: var(--el-color-primary); color: white; font: inherit; font-weight: 600; cursor: pointer; }
.primary-button:disabled { opacity: .55; cursor: not-allowed; }
@media (max-width: 680px) { .editor-heading { flex-direction: column; } .step-fields { grid-template-columns: 1fr 1fr 36px; } .binding-row { grid-template-columns: 58px 14px minmax(0, 1fr); } .binding-row select { min-width: 0; } }
@media (max-width: 420px) { .workflow-editor { padding: 16px; } .step-card { grid-template-columns: 28px minmax(0, 1fr); gap: 8px; padding: 12px; } .step-index { width: 28px; height: 30px; } .step-fields { grid-template-columns: minmax(0, 1fr) 36px; } .step-fields .field:nth-child(2) { grid-column: 1 / -1; grid-row: 2; } .remove-step { grid-column: 2; grid-row: 1; } }
</style>
