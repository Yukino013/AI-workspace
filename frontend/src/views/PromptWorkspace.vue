<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import PageHeading from "@/components/common/PageHeading.vue";
import LoadError from "@/components/common/LoadError.vue";
import PromptEditor from "@/components/PromptEditor.vue";
import VariableForm from "@/components/VariableForm.vue";
import ModelSelector from "@/components/ModelSelector.vue";
import PromptOutputPanel from "@/components/prompt/PromptOutputPanel.vue";
import PromptVersionDialog from "@/components/prompt/PromptVersionDialog.vue";
import {
  createPrompt,
  getPrompt,
  getVersions,
  restoreVersion,
  updatePrompt,
} from "@/api/prompt";
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
const loadError = shallowRef("");
const abortCtrl = shallowRef<AbortController | null>(null);
const versions = ref<PromptVersion[]>([]);
const versionsVisible = shallowRef(false);

const variables = computed(() => extractVariables(form.value.content));
const sortedVersions = computed(() =>
  [...versions.value].sort((a, b) => b.version - a.version),
);

function resetForm() {
  form.value = { name: "", description: "", content: "" };
  variableValues.value = {};
  versions.value = [];
  output.value = "";
}

let initialization = 0;
async function init() {
  const current = ++initialization;
  stop();
  loadError.value = "";
  versionsVisible.value = false;
  store.reset();
  resetForm();
  if (isNew.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const p = await getPrompt(route.params.id as string);
    if (current !== initialization) return;
    store.loadPrompt(p);
    form.value = {
      name: p.name,
      description: p.description,
      content: p.content,
    };
    variableValues.value = {};
    output.value = "";
    const history = await getVersions(p.id);
    if (current === initialization) versions.value = history;
  } catch {
    if (current === initialization)
      loadError.value = "Prompt 加载失败，请重新加载后再编辑。";
  } finally {
    if (current === initialization) loading.value = false;
  }
}

async function save() {
  if (saving.value || streaming.value || loading.value || loadError.value)
    return;
  if (!form.value.name.trim() || !form.value.content.trim()) {
    ElMessage.warning("名称和 Prompt 内容不能为空");
    return;
  }
  saving.value = true;
  const current = initialization;
  try {
    if (isNew.value) {
      const created = await createPrompt({
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        content: form.value.content,
      });
      if (current !== initialization) return;
      ElMessage.success("创建成功");
      await router.replace(`/prompts/${created.id}`);
    } else {
      const p = await updatePrompt(route.params.id as string, {
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        content: form.value.content,
      });
      if (current !== initialization) return;
      store.loadPrompt(p);
      const history = await getVersions(p.id);
      if (current !== initialization) return;
      versions.value = history;
      ElMessage.success("已保存（内容有变化时会生成新版本）");
    }
  } catch {
    /* HTTP 层统一提示 */
  } finally {
    saving.value = false;
  }
}

async function run() {
  if (streaming.value || saving.value || loading.value || loadError.value)
    return;

  if (isNew.value) {
    ElMessage.warning("请先保存 Prompt，再运行调试");
    return;
  }
  if (form.value.content !== store.current?.content) {
    ElMessage.warning("内容已修改，请先保存再运行，避免使用旧版本");
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
    onChunk: (text) => {
      if (abortCtrl.value === controller) output.value += text;
    },
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
  if (saving.value || streaming.value || loading.value || loadError.value)
    return;
  const current = initialization;
  const promptId = route.params.id as string;
  try {
    await ElMessageBox.confirm(
      `确定恢复到 v${v.version}？当前内容将被历史版本替换。`,
      "恢复版本",
      { type: "warning", confirmButtonText: "恢复", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  if (current !== initialization || saving.value || streaming.value) return;
  saving.value = true;
  try {
    await restoreVersion(promptId, v.version);
    if (current !== initialization) return;
    ElMessage.success("已恢复");
    await init();
  } catch {
    /* HTTP 层统一提示 */
  } finally {
    saving.value = false;
  }
}

onMounted(init);
watch(() => route.fullPath, init);
onBeforeUnmount(() => {
  ++initialization;
  stop();
});
</script>

<template>
  <div>
    <PageHeading
      eyebrow="PROMPT PLAYGROUND"
      :title="isNew ? '创建你的下一个 Prompt' : '打磨想法，调试更好的结果'"
      description="编辑内容，填写变量，选择模型。每一次修改都可以成为新的版本。"
    />
    <LoadError v-if="loadError" :message="loadError" @retry="init" />
    <div v-else v-loading="loading" class="workspace">
      <!-- 左侧：Prompt 编辑 + 变量 + 模型 + 操作 -->
      <el-card shadow="never" class="panel-left">
        <template #header>
          <div class="panel-header">
            <div class="panel-title">
              <span class="title-text">Prompt 编辑器</span>
              <el-tag v-if="!isNew" size="small" type="info" effect="plain">
                v{{ store.current?.currentVersion ?? 1 }}
              </el-tag>
            </div>
            <div class="header-actions">
              <el-button
                v-if="!isNew"
                link
                type="primary"
                @click="versionsVisible = true"
              >
                历史版本
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="saving"
                :disabled="streaming || loading"
                @click="save"
              >
                {{ isNew ? "创建" : "保存" }}
              </el-button>
            </div>
          </div>
        </template>

        <el-form label-position="top">
          <el-form-item label="名称">
            <el-input
              v-model="form.name"
              placeholder="Prompt 名称"
              :maxlength="50"
            />
          </el-form-item>
          <el-form-item label="描述">
            <el-input
              v-model="form.description"
              placeholder="可选，一句话说明用途"
              :maxlength="200"
            />
          </el-form-item>
        </el-form>

        <div class="section-title">内容</div>
        <PromptEditor v-model="form.content" />

        <div class="section-title">变量</div>
        <VariableForm v-model:values="variableValues" :variables="variables" />

        <div class="section-title">模型</div>
        <ModelSelector v-model="store.model" />

        <div class="actions">
          <el-button
            type="primary"
            size="large"
            class="run-btn"
            :loading="streaming"
            :disabled="saving || loading"
            @click="run"
          >
            运行
          </el-button>
          <el-button v-if="streaming" size="large" @click="stop"
            >停止</el-button
          >
        </div>
      </el-card>

      <PromptOutputPanel :output="output" :streaming="streaming" />

      <PromptVersionDialog
        v-model="versionsVisible"
        :versions="sortedVersions"
        @restore="onRestore"
      />
    </div>
  </div>
</template>

<style scoped>
.workspace {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}
.panel-left {
  border: 1px solid var(--el-border-color-light);
  background: var(--app-bg);
  min-width: 0;
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
}
@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }
}
</style>
