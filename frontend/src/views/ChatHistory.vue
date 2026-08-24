<script setup lang="ts">
import { onMounted, ref, shallowRef } from "vue";
import { deleteChatRecord, getChatRecords } from "@/api/chat";
import { md } from "@/utils/markdown";
import type { ChatRecord } from "@/types";
import { ElMessage, ElMessageBox } from "element-plus";

const loading = shallowRef(false);
const list = ref<ChatRecord[]>([]);
const total = shallowRef(0);
const page = shallowRef(1);
const pageSize = shallowRef(20);

const detail = ref<ChatRecord | null>(null);
const dialogVisible = shallowRef(false);

const statusMeta: Record<ChatRecord["status"], { text: string; type: "success" | "danger" | "info" }> = {
  success: { text: "成功", type: "success" },
  error: { text: "失败", type: "danger" },
  aborted: { text: "已停止", type: "info" },
};
const deletingId = shallowRef<string | null>(null);

async function onDelete(row: ChatRecord) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.promptName || "这条调用记录"}」？删除后无法恢复。`, "删除确认", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch {
    return;
  }

  deletingId.value = row.id;

  try {
    await deleteChatRecord(row.id);

    if (detail.value?.id === row.id) {
      dialogVisible.value = false;
      detail.value = null;
    }

    // 避免删除当前页最后一条后停留在空白页
    if (list.value.length === 1 && page.value > 1) {
      page.value -= 1;
    }

    await fetchList();
    ElMessage.success("调用记录已删除");
  } finally {
    deletingId.value = null;
  }
}
function statusText(status: string) {
  return statusMeta[status as ChatRecord["status"]]?.text ?? status;
}

function statusType(status: string) {
  return statusMeta[status as ChatRecord["status"]]?.type ?? "info";
}

async function fetchList() {
  loading.value = true;
  try {
    const data = await getChatRecords({ page: page.value, pageSize: pageSize.value });
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function openDetail(row: ChatRecord) {
  detail.value = row;
  dialogVisible.value = true;
}

function onPageChange(nextPage: number) {
  page.value = nextPage;
  fetchList();
}

function formatTime(v: string) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(fetchList);
</script>

<template>
  <div>
    <el-table v-loading="loading" :data="list" empty-text="暂无调用记录，去工作台运行一次吧">
      <el-table-column label="调用时间" width="150">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column prop="promptName" label="Prompt" min-width="180" show-overflow-tooltip />
      <el-table-column prop="model" label="模型" width="160" />
      <el-table-column label="耗时" width="100">
        <template #default="{ row }">{{ (row.duration / 1000).toFixed(2) }}s</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" align="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看</el-button>
          <el-button link type="danger" :loading="deletingId === row.id" @click="onDelete(row)"> 删除 </el-button>
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

    <el-dialog v-model="dialogVisible" title="调用详情" width="720">
      <template v-if="detail">
        <el-descriptions :column="2" border size="small" class="meta">
          <el-descriptions-item label="Prompt">{{ detail.promptName || "-" }}</el-descriptions-item>
          <el-descriptions-item label="版本">v{{ detail.promptVersion }}</el-descriptions-item>
          <el-descriptions-item label="模型">{{ detail.model }}</el-descriptions-item>
          <el-descriptions-item label="耗时"> {{ (detail.duration / 1000).toFixed(2) }}s </el-descriptions-item>
          <el-descriptions-item label="Token">
            {{ detail.tokenUsage?.totalTokens ?? "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusType(detail.status)">{{ statusText(detail.status) }}</el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <h4 class="block-title">AI 输入</h4>
        <pre class="block-content">{{ detail.input }}</pre>

        <h4 class="block-title">AI 输出</h4>
        <div class="block-content markdown-body" v-html="md.render(detail.output)"></div>

        <p v-if="detail.errorMessage" class="error-msg">{{ detail.errorMessage }}</p>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}
.meta {
  margin-bottom: 8px;
}
.block-title {
  margin: 16px 0 8px;
}
.block-content {
  max-height: 300px;
  overflow: auto;
  padding: 12px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
  white-space: pre-wrap;
  word-break: break-word;
}
.error-msg {
  color: var(--el-color-danger);
}
</style>
