<script setup lang="ts">
import { onMounted, reactive, shallowRef } from 'vue';
import { ElMessage } from 'element-plus';
import { getProviders, updateProviders } from '@/api/provider';
import type { ProviderConfig } from '@/types';

const loading = shallowRef(false);
const saving = shallowRef(false);
const providers = shallowRef<ProviderConfig[]>([]);
const values = reactive<Record<ProviderConfig['id'], string>>({ deepseek: '', qwen: '', anthropic: '' });

async function load() {
  loading.value = true;
  try { providers.value = await getProviders(); } finally { loading.value = false; }
}

async function save(id: ProviderConfig['id']) {
  const value = values[id].trim();
  if (!value) { ElMessage.warning('请输入 API Key'); return; }
  saving.value = true;
  try {
    providers.value = await updateProviders({ [id]: value });
    values[id] = '';
    ElMessage.success('API Key 已保存');
  } finally { saving.value = false; }
}

async function clear(id: ProviderConfig['id']) {
  saving.value = true;
  try {
    providers.value = await updateProviders({ [id]: '' });
    ElMessage.success('已清除自定义 API Key，将使用服务端默认配置');
  } finally { saving.value = false; }
}

onMounted(load);
</script>

<template>
  <div v-loading="loading" class="provider-page">
    <div class="page-heading">
      <div>
        <h2>Provider 配置</h2>
        <p>保存你自己的 API Key。密钥仅用于服务端调用，不会展示明文。</p>
      </div>
    </div>
    <div class="provider-list">
      <el-card v-for="item in providers" :key="item.id" shadow="never" class="provider-card">
        <div class="provider-header">
          <div><h3>{{ item.name }}</h3><span class="model">{{ item.model }}</span></div>
          <el-tag :type="item.hasCustomKey ? 'success' : item.configured ? 'info' : 'warning'" effect="plain">
            {{ item.hasCustomKey ? '使用自定义 Key' : item.configured ? '使用服务端默认 Key' : '未配置' }}
          </el-tag>
        </div>
        <div class="key-row">
          <el-input v-model="values[item.id]" type="password" show-password clearable
            :placeholder="item.maskedKey ? `当前：${item.maskedKey}，输入新 Key 覆盖` : '输入 API Key'"
            @keyup.enter="save(item.id)" />
          <el-button type="primary" :loading="saving" @click="save(item.id)">保存</el-button>
          <el-button v-if="item.hasCustomKey" :loading="saving" @click="clear(item.id)">清除</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.provider-page { max-width: 860px; margin: 0 auto; padding: 24px 16px; }
.page-heading { margin-bottom: 20px; }
.page-heading h2 { margin: 0; color: var(--app-text); }
.page-heading p { margin: 8px 0 0; color: var(--app-muted); font-size: 13px; }
.provider-list { display: grid; gap: 14px; }
.provider-card { border: 1px solid var(--el-border-color-light); background: var(--app-bg); }
.provider-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
.provider-header h3 { margin: 0 0 4px; color: var(--app-text); font-size: 16px; }
.model { color: var(--app-muted); font-size: 12px; }
.key-row { display: flex; gap: 10px; }
.key-row .el-input { flex: 1; }
@media (max-width: 600px) { .key-row { flex-wrap: wrap; } .key-row .el-input { flex-basis: 100%; } }
</style>
