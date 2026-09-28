<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from "vue";
import { getHistory } from "@/api/history";
import type { HistoryItem } from "@/types";
import PageHeading from "@/components/common/PageHeading.vue";
import LoadError from "@/components/common/LoadError.vue";
import AppIcon from "@/components/common/AppIcon.vue";
import HistoryDetail from "@/components/history/HistoryDetail.vue";
const keyword = shallowRef("");
const type = shallowRef("");
const page = shallowRef(1);
const pageSize = 20;
const total = shallowRef(0);
const loading = shallowRef(false);
const error = shallowRef("");
const items = shallowRef<HistoryItem[]>([]);
const detail = shallowRef<HistoryItem | null>(null);
const visible = shallowRef(false);
let requestId = 0;
async function load() {
  const current = ++requestId;
  loading.value = true;
  error.value = "";
  try {
    const result = await getHistory({
      keyword: keyword.value.trim() || undefined,
      type: type.value || undefined,
      page: page.value,
      pageSize,
    });
    if (current !== requestId) return;
    items.value = result.items;
    total.value = result.total;
  } catch {
    if (current === requestId) error.value = "历史记录加载失败，请稍后重试。";
  } finally {
    if (current === requestId) loading.value = false;
  }
}
function search() {
  page.value = 1;
  load();
}
function onPageChange(value: number) {
  page.value = value;
  load();
}
function open(item: HistoryItem) {
  detail.value = item;
  visible.value = true;
}
onMounted(load);
onBeforeUnmount(() => {
  ++requestId;
});
</script>
<template>
  <div>
    <PageHeading
      eyebrow="YOUR ACTIVITY"
      title="每一次探索，都有迹可循"
      description="统一检索 AI 对话与代码处理结果，继续创作，无需从头开始。"
      ><el-button @click="$router.push('/call-records')"
        >查看 Prompt 调用记录</el-button
      ></PageHeading
    >
    <section class="history-panel">
      <form class="filters" @submit.prevent="search">
        <span class="record-count"
          >全部记录 <small>{{ total }}</small></span
        ><el-input
          v-model="keyword"
          aria-label="搜索历史记录"
          placeholder="搜索标题、输入或输出…"
          clearable
          @clear="search"
          ><template #prefix
            ><AppIcon name="search" :size="16" /></template></el-input
        ><el-select
          v-model="type"
          aria-label="记录来源"
          placeholder="全部来源"
          clearable
          @change="search"
          ><el-option label="AI 对话" value="chat" /><el-option
            label="代码工具"
            value="code-tool" /></el-select
        ><el-button type="primary" native-type="submit" :loading="loading"
          >搜索</el-button
        >
      </form>
      <LoadError v-if="error" :message="error" @retry="load" /><el-table
        v-loading="loading"
        :data="items"
        @row-click="open"
        ><el-table-column label="来源" width="120"
          ><template #default="{ row }"
            ><el-tag
              :type="row.type === 'chat' ? 'info' : 'success'"
              effect="plain"
              size="small"
              >{{ row.type === "chat" ? "AI 对话" : "代码工具" }}</el-tag
            ></template
          ></el-table-column
        ><el-table-column label="标题" min-width="230"
          ><template #default="{ row }"
            ><button class="record-title" @click.stop="open(row)">
              {{ row.title }}
            </button>
            <div class="record-preview">
              {{ row.input || "暂无输入" }}
            </div></template
          ></el-table-column
        ><el-table-column
          prop="model"
          label="模型"
          min-width="150" /><el-table-column label="状态" width="100"
          ><template #default="{ row }"
            ><el-tag v-if="row.status === 'error'" size="small" type="danger"
              >失败</el-tag
            ><el-tag
              v-else-if="row.status === 'aborted'"
              size="small"
              type="warning"
              >已停止</el-tag
            ><span v-else>{{
              row.output ? "已完成" : "待回复"
            }}</span></template
          ></el-table-column
        ><el-table-column label="时间" min-width="175"
          ><template #default="{ row }">{{
            new Date(row.createdAt).toLocaleString()
          }}</template></el-table-column
        ><el-table-column label="操作" width="80" fixed="right"
          ><template #default="{ row }"
            ><el-button link type="primary" @click.stop="open(row)"
              >详情</el-button
            ></template
          ></el-table-column
        ><template #empty
          ><el-empty
            :description="
              keyword || type
                ? '未找到匹配记录，试试其他筛选条件'
                : '还没有记录，开始对话或运行代码工具吧'
            "
            :image-size="85" /></template></el-table
      ><el-pagination
        v-if="total > pageSize"
        :current-page="page"
        :total="total"
        :page-size="pageSize"
        layout="prev, pager, next, total"
        @current-change="onPageChange"
      />
    </section>
    <HistoryDetail v-model="visible" :item="detail" />
  </div>
</template>
<style scoped>
.history-panel {
  border: 1px solid var(--el-border-color-light);
  background: var(--app-bg);
  border-radius: 12px;
  overflow: hidden;
}
.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px;
}
.record-count {
  margin-right: auto;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
}
.record-count small {
  margin-left: 8px;
  color: var(--app-muted);
  font-weight: 400;
}
.filters .el-input {
  width: 270px;
}
.filters .el-select {
  width: 130px;
}
.record-title {
  border: 0;
  background: none;
  color: var(--app-text);
  padding: 0;
  font-size: 13px;
  font-weight: 550;
  text-align: left;
}
.record-preview {
  font-size: 11px;
  color: var(--app-muted);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  margin-top: 4px;
}
.record-title:hover {
  color: var(--el-color-primary);
}
.el-pagination {
  padding: 18px;
  justify-content: flex-end;
}
.history-panel :deep(.el-table__row) {
  cursor: pointer;
}
.history-panel :deep(.el-table__cell:first-child) {
  padding-left: 14px;
}
@media (max-width: 1100px) {
  .filters {
    flex-wrap: wrap;
  }
  .record-count {
    flex-basis: 100%;
  }
  .filters .el-input {
    flex: 1;
    min-width: 100px;
  }
}
@media (max-width: 500px) {
  .filters {
    padding: 16px;
    gap: 8px;
  }
  .filters .el-input {
    flex-basis: 100%;
  }
  .filters .el-select {
    flex: 1;
  }
}
</style>
