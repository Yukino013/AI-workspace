<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import PromptEditor from "@/components/PromptEditor.vue";
import VariableForm from "@/components/VariableForm.vue";
import ModelSelector from "@/components/ModelSelector.vue";
import PromptOutputPanel from "@/components/prompt/PromptOutputPanel.vue";
import PromptVersionDialog from "@/components/prompt/PromptVersionDialog.vue";
import { createPrompt, getPrompt, getVersions, restoreVersion, updatePrompt } from "@/api/prompt";
import { streamChat } from "@/utils/sse";
import { extractVariables } from "@/utils/variables";
import { usePromptStore } from "@/stores/prompt";
import type { PromptVersion } from "@/types";

const route = useRoute();
const router = useRouter();
const store = usePromptStore();

const isNew = computed(() => route.path === "/prompts/new");

const form = ref({
  name: "",
  description: "",
  content: "",
});

const variableValues = ref<Record<string, string>>({});
const output = shallowRef("");
const streaming = shallowRef(false);
const saving = shallowRef(false);
const loading = shallowRef(false);
const abortCtrl = shallowRef<AbortController | null>(null);
const versions = ref<PromptVersion[]>([]);
const versionsVisible = shallowRef(false);

const variables = computed(() => extractVariables(form.value.content));
const sortedVersions = computed(() => [...versions.value].sort((a, b) => b.version - a.version));

function resetForm() {
  form.value = { name: "", description: "", content: "" };
  variableValues.value = {};
  versions.value = [];
  output.value = "";
}

async function init() {
  stop();
  if (isNew.value) {
    store.reset();
    resetForm();
    return;
  }
  loading.value = true;
  try {
    const p = await getPrompt(route.params.id as string);
    store.loadPrompt(p);
    form.value = {
      name: p.name,
      description: p.description,
      content: p.content,
    };
    variableValues.value = {};
    output.value = "";
    versions.value = await getVersions(p.id);
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!form.value.name.trim() || !form.value.content.trim()) {
    ElMessage.warning("名称和 Prompt 内容不能为空");
    return;
  }
  saving.value = true;
  try {
    if (isNew.value) {
      await createPrompt({
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        content: form.value.content,
      });
      ElMessage.success("创建成功");
      await router.replace('/prompts');
    } else {
      const p = await updatePrompt(route.params.id as string, {
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        content: form.value.content,
      });
      store.loadPrompt(p);
      versions.value = await getVersions(p.id);
      ElMessage.success("已保存（内容有变化时会生成新版本）");
    }
  } finally {
    saving.value = false;
  }
}

async function run() {
  if (streaming.value) return;

  if (isNew.value) {
    ElMessage.warning("请先保存 Prompt，再运行调试");
    return;
  }
  for (const key of variables.value) {
    if (!variableValues.value[key]?.trim()) {
      ElMessage.warning(`请填写变量 {{${key}}}`);
      return;
    }
  }

  const payload = {
    promptId: route.params.id as string,
    model: store.model,
    variables: { ...variableValues.value },
  };

  output.value = "";
  streaming.value = true;
  store.running = true;

  const controller = streamChat(payload, {
    onChunk: (text) => (output.value += text),
    onDone: () => {
      if (abortCtrl.value !== controller) return;
      abortCtrl.value = null;
      streaming.value = false;
      store.running = false;
    },
    onError: (err) => {
      if (abortCtrl.value !== controller) return;
      abortCtrl.value = null;
      streaming.value = false;
      store.running = false;
      ElMessage.error(`流式请求失败：${err.message}`);
    },
  });
  abortCtrl.value = controller;
}

function stop() {
  const controller = abortCtrl.value;
  abortCtrl.value = null;
  controller?.abort();
  streaming.value = false;
  store.running = false;
}

async function onRestore(v: PromptVersion) {
  try {
    await ElMessageBox.confirm(`确定恢复到 v${v.version}？当前内容将被历史版本替换。`, "恢复版本", { type: "warning", confirmButtonText: "恢复", cancelButtonText: "取消" });
  } catch {
    return;
  }
  await restoreVersion(route.params.id as string, v.version);
  ElMessage.success("已恢复");
  await init();
}

onMounted(init);
watch(() => route.fullPath, init);
onBeforeUnmount(stop);
</script>

<template>
  <div v-loading="loading" class="workspace">
    <!-- 左侧：Prompt 编辑 + 变量 + 模型 + 操作 -->
    <el-card shadow="never" class="panel-left">
      <template #header>
        <div class="panel-header">
          <div class="panel-title">
            <span class="title-text">Prompt 编辑器</span>
            <el-tag v-if="!isNew" size="small" type="info" effect="plain"> v{{ store.current?.currentVersion ?? 1 }} </el-tag>
          </div>
          <div class="header-actions">
            <el-button v-if="!isNew" link type="primary" @click="versionsVisible = true"> 历史版本 </el-button>
            <el-button type="primary" size="small" :loading="saving" @click="save">
              {{ isNew ? "创建" : "保存" }}
            </el-button>
          </div>
        </div>
      </template>

      <el-form label-position="top">
        <el-form-item label="名称">
          <el-input v-model="form.name" placeholder="Prompt 名称" :maxlength="50" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="可选，一句话说明用途" :maxlength="200" />
        </el-form-item>
      </el-form>

      <div class="section-title">内容</div>
      <PromptEditor v-model="form.content" />

      <div class="section-title">变量</div>
      <VariableForm v-model:values="variableValues" :variables="variables" />

      <div class="section-title">模型</div>
      <ModelSelector v-model="store.model" />

      <div class="actions">
        <el-button type="primary" size="large" class="run-btn" :loading="streaming" @click="run"> 运行 </el-button>
        <el-button v-if="streaming" size="large" @click="stop">停止</el-button>
      </div>
    </el-card>

    <PromptOutputPanel :output="output" :streaming="streaming" />

    <PromptVersionDialog v-model="versionsVisible" :versions="sortedVersions" @restore="onRestore" />
  </div>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}
.panel-left {
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
  gap: 8px;
}
.title-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--app-text);
}
.title-text::before {
  content: ">_ ";
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--tech-cyan);
  font-weight: 400;
}
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 20px 0 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--app-text);
}
.section-title::before {
  content: "";
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--tech-violet), var(--tech-cyan));
}
.actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}
.run-btn {
  flex: 1;
  --el-button-bg-color: var(--tech-violet);
  --el-button-border-color: var(--tech-violet);
  --el-button-hover-bg-color: var(--tech-cyan);
  --el-button-hover-border-color: var(--tech-cyan);
  --el-button-active-bg-color: var(--tech-violet);
  --el-button-active-border-color: var(--tech-violet);
}
@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}
</style>
