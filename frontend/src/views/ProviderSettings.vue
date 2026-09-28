<script setup lang="ts">
import { onMounted, reactive, shallowRef } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { getProviders, updateProviders } from "@/api/provider";
import type { ProviderConfig } from "@/types";
import PageHeading from "@/components/common/PageHeading.vue";
import LoadError from "@/components/common/LoadError.vue";
import AppIcon from "@/components/common/AppIcon.vue";

const loading = shallowRef(false);
const saving = shallowRef<ProviderConfig["id"] | null>(null);
const error = shallowRef("");
const providers = shallowRef<ProviderConfig[]>([]);
const values = reactive<Record<ProviderConfig["id"], string>>({
  deepseek: "",
  qwen: "",
  anthropic: "",
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    providers.value = await getProviders();
  } catch {
    error.value = "模型配置加载失败，请重试。";
  } finally {
    loading.value = false;
  }
}

async function save(id: ProviderConfig["id"]) {
  if (saving.value) return;
  const value = values[id].trim();
  if (!value) {
    ElMessage.warning("请输入 API Key");
    return;
  }
  saving.value = id;
  try {
    providers.value = await updateProviders({ [id]: value });
    values[id] = "";
    ElMessage.success("API Key 已保存");
  } catch {
    /* HTTP 层统一提示 */
  } finally {
    saving.value = null;
  }
}

async function clear(id: ProviderConfig["id"]) {
  if (saving.value) return;
  try {
    await ElMessageBox.confirm(
      "清除后将使用服务端默认密钥；如无默认配置，该模型将无法调用。",
      "清除自定义密钥",
      { type: "warning", confirmButtonText: "清除", cancelButtonText: "取消" },
    );
  } catch {
    return;
  }
  saving.value = id;
  try {
    providers.value = await updateProviders({ [id]: "" });
    ElMessage.success("已清除自定义 API Key，将使用服务端默认配置");
  } catch {
    /* HTTP 层统一提示 */
  } finally {
    saving.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="provider-page">
    <PageHeading
      eyebrow="CONNECTED INTELLIGENCE"
      title="连接你的 AI 能力"
      description="统一管理模型 API Key，供 Prompt、对话与代码工具共享使用。"
    />
    <div class="security-note">
      <AppIcon name="settings" :size="18" /><span
        >密钥仅用于服务端调用，页面不会展示明文。请勿与他人共享你的账号。</span
      >
    </div>
    <LoadError v-if="error" :message="error" @retry="load" />
    <div class="provider-list">
      <el-card
        v-for="item in providers"
        :key="item.id"
        shadow="never"
        class="provider-card"
      >
        <div class="provider-header">
          <div>
            <h3>{{ item.name }}</h3>
            <span class="model">{{ item.model }}</span>
          </div>
          <el-tag
            :type="
              item.hasCustomKey
                ? 'success'
                : item.configured
                  ? 'info'
                  : 'warning'
            "
            effect="plain"
          >
            {{
              item.hasCustomKey
                ? "使用自定义 Key"
                : item.configured
                  ? "使用服务端默认 Key"
                  : "未配置"
            }}
          </el-tag>
        </div>
        <div class="key-row">
          <el-input
            v-model="values[item.id]"
            :aria-label="`${item.name} API Key`"
            type="password"
            autocomplete="off"
            show-password
            clearable
            :placeholder="
              item.maskedKey
                ? `当前：${item.maskedKey}，输入新 Key 覆盖`
                : '输入 API Key'
            "
            @keyup.enter="save(item.id)"
          />
          <el-button
            type="primary"
            :loading="saving === item.id"
            :disabled="!!saving && saving !== item.id"
            @click="save(item.id)"
            >保存</el-button
          >
          <el-button
            v-if="item.hasCustomKey"
            :loading="saving === item.id"
            :disabled="!!saving && saving !== item.id"
            @click="clear(item.id)"
            >清除</el-button
          >
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.provider-page {
  max-width: 1000px;
  margin: 0 auto;
}
.security-note {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  padding: 16px 18px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.7;
  margin-bottom: 24px;
}
.security-note .app-icon {
  flex-shrink: 0;
}
.page-heading {
  margin-bottom: 20px;
}
.page-heading h2 {
  margin: 0;
  color: var(--app-text);
}
.page-heading p {
  margin: 8px 0 0;
  color: var(--app-muted);
  font-size: 13px;
}
.provider-list {
  display: grid;
  gap: 14px;
}
.provider-card {
  border: 1px solid var(--el-border-color-light);
  background: var(--app-bg);
}
.provider-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}
.provider-header h3 {
  margin: 0 0 4px;
  color: var(--app-text);
  font-size: 16px;
}
.model {
  color: var(--app-muted);
  font-size: 12px;
}
.key-row {
  display: flex;
  gap: 10px;
}
.key-row .el-input {
  flex: 1;
}
@media (max-width: 600px) {
  .key-row {
    flex-wrap: wrap;
  }
  .key-row .el-input {
    flex-basis: 100%;
  }
}
</style>
