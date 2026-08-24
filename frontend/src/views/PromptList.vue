<script setup lang="ts">
import { onMounted, shallowRef, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { deletePrompt, getPrompts } from '@/api/prompt';
import type { Prompt } from '@/types';

const router = useRouter();

const loading = shallowRef(false);
const keyword = shallowRef('');
const list = ref<Prompt[]>([]);
const total = shallowRef(0);
const page = shallowRef(1);
const pageSize = shallowRef(20);

async function fetchList() {
  loading.value = true;
  try {
    const data = await getPrompts({
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  fetchList();
}

function onPageChange(nextPage: number) {
  page.value = nextPage;
  fetchList();
}

function goWorkspace(p: Prompt) {
  router.push(`/prompts/${p.id}`);
}

async function onDelete(p: Prompt) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${p.name}」？其历史版本与调用记录将一并删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    );
  } catch {
    return; // 用户取消
  }
  await deletePrompt(p.id);
  ElMessage.success('已删除');
  fetchList();
}

function formatTime(v: string) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(fetchList);
</script>

<template>
  <div>
    <div class="toolbar">
      <div class="toolbar-title">
        <span class="title">Prompt 管理</span>
        <span class="count">共 {{ total }} 个</span>
      </div>
      <div class="toolbar-actions">
        <el-input
          v-model="keyword"
          placeholder="搜索 Prompt 名称 / 描述"
          clearable
          class="search"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-button type="primary" @click="router.push('/prompts/new')">
          新建 Prompt
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      empty-text="还没有 Prompt，点击右上角「新建 Prompt」"
      class="prompt-table"
      @row-click="goWorkspace"
    >
      <el-table-column label="名称" min-width="200">
        <template #default="{ row }">
          <span class="prompt-name">{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column label="描述" min-width="260">
        <template #default="{ row }">
          <span class="desc">{{ row.description || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="版本" width="90">
        <template #default="{ row }">
          <el-tag size="small" type="info" effect="plain">v{{ row.currentVersion }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="140">
        <template #default="{ row }">
          <span class="time">{{ formatTime(row.updatedAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" align="right">
        <template #default="{ row }">
          <el-button link type="danger" @click.stop="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > pageSize"
      class="pagination"
      layout="prev, pager, next, total"
      :total="total"
      :page-size="pageSize"
      :current-page="page"
      @current-change="onPageChange"
    />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.toolbar-title .title {
  font-size: 16px;
  font-weight: 500;
  color: var(--app-text);
}
.toolbar-title .title::before {
  content: '>_ ';
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--tech-cyan);
  font-weight: 400;
}
.toolbar-title .count {
  font-size: 13px;
  color: var(--app-muted);
}
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.search {
  width: 260px;
}
.prompt-table {
  --el-table-border-color: var(--el-border-color-light);
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  overflow: hidden;
  background: var(--app-bg);
}
.prompt-name {
  font-weight: 500;
  color: var(--app-text);
  transition: color 0.2s;
}
.prompt-table :deep(.el-table__row) {
  cursor: pointer;
}
.prompt-table :deep(.el-table__row:hover) .prompt-name {
  color: var(--tech-cyan);
}
.desc,
.time {
  color: var(--app-muted);
}
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
</style>
