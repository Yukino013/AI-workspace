<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createWorkflow, deleteWorkflow, getWorkflow, getWorkflowRuns, getWorkflows, updateWorkflow } from '@/api/workflow';
import { getPrompts } from '@/api/prompt';
import { getProviders } from '@/api/provider';
import { useWorkflowRunner } from '@/composables/useWorkflowRunner';
import WorkflowEditor, { type WorkflowDraft } from '@/components/workflow/WorkflowEditor.vue';
import WorkflowList from '@/components/workflow/WorkflowList.vue';
import WorkflowRunPanel from '@/components/workflow/WorkflowRunPanel.vue';
import type { PageResult, Prompt, ProviderConfig, Workflow, WorkflowRun } from '@/types';

const workflows = shallowRef<Workflow[]>([]);
const prompts = shallowRef<Prompt[]>([]);
const providers = shallowRef<ProviderConfig[]>([]);
const runs = shallowRef<WorkflowRun[]>([]);
const workflowId = ref('');
const editing = ref(false);
const loading = ref(true);
const saving = ref(false);
const pageError = ref('');
const draft = ref<WorkflowDraft>({ name: '', description: '', steps: [] });
const { inputs, activeRun, running, error: runError, start, stop } = useWorkflowRunner();

const currentWorkflow = computed(() => workflows.value.find((workflow) => workflow.id === workflowId.value) ?? null);
function toDraft(workflow: Workflow): WorkflowDraft {
  return {
    name: workflow.name,
    description: workflow.description,
    steps: workflow.steps.map(({ id, promptId, model, bindings }) => ({ id, promptId, model, bindings: { ...bindings } })),
  };
}
function toPayload(value: WorkflowDraft) {
  return {
    name: value.name.trim(),
    description: value.description.trim(),
    steps: value.steps.map((step) => ({ ...step, bindings: { ...step.bindings } })),
  };
}
const hasUnsavedChanges = computed(() => {
  if (!workflowId.value || !currentWorkflow.value) return true;
  return JSON.stringify(toPayload(draft.value)) !== JSON.stringify(toPayload(toDraft(currentWorkflow.value)));
});
const canRun = computed(() => !hasUnsavedChanges.value && Boolean(currentWorkflow.value));

async function refreshLists() {
  const [workflowItems, promptPage, providerItems] = await Promise.all([
    getWorkflows(),
    getPrompts({ page: 1, pageSize: 100 }),
    getProviders(),
  ]);
  workflows.value = workflowItems;
  prompts.value = promptPage.items;
  providers.value = providerItems;
}

async function refreshRuns() {
  if (!workflowId.value) {
    runs.value = [];
    return;
  }
  const page: PageResult<WorkflowRun> = await getWorkflowRuns(workflowId.value);
  runs.value = page.items;
  if (activeRun.value) {
    activeRun.value = page.items.find((run) => run.id === activeRun.value?.id) ?? activeRun.value;
  }
}

async function initialize() {
  loading.value = true;
  pageError.value = '';
  try {
    await refreshLists();
  } catch (cause) {
    pageError.value = cause instanceof Error ? cause.message : '读取工作流失败';
  } finally {
    loading.value = false;
  }
}

function createNew() {
  workflowId.value = '';
  draft.value = { name: '', description: '', steps: [] };
  runs.value = [];
  activeRun.value = null;
  inputs.value = {};
  editing.value = true;
}

async function openWorkflow(workflow: Workflow) {
  pageError.value = '';
  try {
    const latest = await getWorkflow(workflow.id);
    workflows.value = [latest, ...workflows.value.filter((item) => item.id !== latest.id)];
    workflowId.value = latest.id;
    draft.value = toDraft(latest);
    activeRun.value = null;
    inputs.value = {};
    editing.value = true;
    await refreshRuns();
  } catch (cause) {
    pageError.value = cause instanceof Error ? cause.message : '读取工作流失败';
  }
}

async function save() {
  if (saving.value) return;
  saving.value = true;
  pageError.value = '';
  try {
    const saved = workflowId.value
      ? await updateWorkflow(workflowId.value, toPayload(draft.value))
      : await createWorkflow(toPayload(draft.value));
    workflowId.value = saved.id;
    draft.value = toDraft(saved);
    workflows.value = [saved, ...workflows.value.filter((item) => item.id !== saved.id)].sort(
      (left, right) => right.updatedAt.localeCompare(left.updatedAt),
    );
    await refreshRuns();
    ElMessage.success('工作流已保存');
  } catch (cause) {
    pageError.value = cause instanceof Error ? cause.message : '保存工作流失败';
  } finally {
    saving.value = false;
  }
}

async function remove(workflow: Workflow) {
  try {
    await ElMessageBox.confirm(
      `删除“${workflow.name}”及其运行记录？此操作不可撤销。`,
      '删除工作流',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    );
    await deleteWorkflow(workflow.id);
    workflows.value = workflows.value.filter((item) => item.id !== workflow.id);
    if (workflowId.value === workflow.id) {
      editing.value = false;
      workflowId.value = '';
    }
    ElMessage.success('工作流已删除');
  } catch (cause) {
    if (cause === 'cancel' || cause === 'close' || (cause instanceof Error && cause.message === 'cancel')) return;
    pageError.value = cause instanceof Error ? cause.message : '删除工作流失败';
  }
}

async function copy(workflow: Workflow) {
  const stepIds = new Map(workflow.steps.map((step) => [step.id, `step-${crypto.randomUUID()}`]));
  const name = `${workflow.name.slice(0, 95)} 副本`;
  try {
    const saved = await createWorkflow({
      name,
      description: workflow.description,
      steps: workflow.steps.map((step) => {
        const newId = stepIds.get(step.id);
        if (!newId) throw new Error('复制工作流时无法生成步骤 ID');
        return {
          id: newId,
          promptId: step.promptId,
          model: step.model,
          bindings: Object.fromEntries(
            Object.entries(step.bindings).map(([variable, source]) => {
              const previousStepId = /^steps\.([A-Za-z0-9_-]+)\.output$/.exec(source)?.[1];
              if (!previousStepId) return [variable, source];
              const newPreviousId = stepIds.get(previousStepId);
              if (!newPreviousId) throw new Error('复制工作流时发现无效的步骤引用');
              return [variable, `steps.${newPreviousId}.output`];
            }),
          ),
        };
      }),
    });
    workflows.value = [saved, ...workflows.value];
    ElMessage.success('工作流副本已创建');
  } catch (cause) {
    pageError.value = cause instanceof Error ? cause.message : '复制工作流失败';
  }
}

function run() {
  if (!workflowId.value || !canRun.value) return;
  start(`/api/workflows/${workflowId.value}/runs/stream`, { inputs: inputs.value }, () => {
    void refreshRuns();
  });
}

function retry() {
  if (!workflowId.value || !activeRun.value) return;
  start(
    `/api/workflows/${workflowId.value}/runs/${activeRun.value.id}/retry/stream`,
    {},
    () => { void refreshRuns(); },
  );
}

function selectRun(run: WorkflowRun) {
  activeRun.value = run;
  inputs.value = { ...run.inputs };
}

function backToList() {
  if (running.value) stop();
  editing.value = false;
  workflowId.value = '';
  activeRun.value = null;
}

onMounted(initialize);
</script>

<template>
  <main class="workflow-page">
    <p v-if="pageError" class="page-error" role="alert">{{ pageError }}</p>
    <div v-if="runError" class="page-error" role="alert">{{ runError }}</div>
    <WorkflowList
      v-if="!editing"
      :workflows="workflows"
      :loading="loading"
      @create="createNew"
      @open="openWorkflow"
      @copy="copy"
      @remove="remove"
    />
    <section v-else class="workflow-workspace">
      <WorkflowEditor
        v-model="draft"
        :prompts="prompts"
        :providers="providers"
        :saving="saving"
        :is-new="!workflowId"
        @save="save"
        @cancel="backToList"
      />
      <WorkflowRunPanel
        v-model:inputs="inputs"
        :workflow="currentWorkflow"
        :run="activeRun"
        :runs="runs"
        :running="running"
        :saving="saving || hasUnsavedChanges"
        :ready-to-run="canRun"
        @run="run"
        @cancel="stop"
        @retry="retry"
        @select-run="selectRun"
      />
    </section>
  </main>
</template>

<style scoped>
.workflow-page { min-height: 100%; }
.workflow-workspace { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(280px, .8fr); align-items: start; gap: 18px; max-width: 1420px; margin: 0 auto; padding: clamp(16px, 3vw, 36px); }
.page-error { max-width: 1320px; margin: 16px auto 0; padding: 12px 16px; border: 1px solid var(--el-color-danger-light-5); border-radius: 10px; background: var(--el-color-danger-light-9); color: var(--el-color-danger); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
@media (max-width: 980px) { .workflow-workspace { grid-template-columns: minmax(0, 1fr); max-width: 760px; } }
@media (max-width: 600px) { .workflow-workspace { padding: 16px; } }
</style>
