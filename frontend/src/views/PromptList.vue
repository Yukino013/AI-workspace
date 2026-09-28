<script setup lang="ts">
import LibraryHero from "@/components/prompt/LibraryHero.vue";
import PromptCard from "@/components/prompt/PromptCard.vue";
import AppIcon from "@/components/common/AppIcon.vue";
import LoadError from "@/components/common/LoadError.vue";
import { onMounted, shallowRef, ref } from "vue";
import { useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { deletePrompt, getPrompts } from "@/api/prompt";
import { copyText } from "@/utils/clipboard";
import type { Prompt } from "@/types";

const router = useRouter();

const viewMode = shallowRef<"grid" | "list">("grid");
const loading = shallowRef(false);
const keyword = shallowRef("");
const list = ref<Prompt[]>([]);
const total = shallowRef(0);
const page = shallowRef(1);
const pageSize = shallowRef(20);

const error = shallowRef("");
let requestId = 0;
async function fetchList() {
  const current = ++requestId;
  error.value = "";
  loading.value = true;
  try {
    const data = await getPrompts({
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    if (current !== requestId) return;
    list.value = data.items;
    total.value = data.total;
  } catch {
    if (current === requestId)
      error.value = "Prompt 加载失败，请检查网络后重试。";
  } finally {
    if (current === requestId) loading.value = false;
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

async function copyTemplate(p: Prompt) {
  try {
    await copyText(p.content);
    ElMessage.success("Prompt 模板已复制");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "复制失败");
  }
}

async function onDelete(p: Prompt) {
  try {
    await ElMessageBox.confirm(
      `确定删除「${p.name}」？其历史版本与调用记录将一并删除。`,
      "删除确认",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" },
    );
  } catch {
    return; // 用户取消
  }
  try {
    await deletePrompt(p.id);
    ElMessage.success("已删除");
    if (list.value.length === 1 && page.value > 1) page.value -= 1;
    await fetchList();
  } catch {
    /* 请求错误由 HTTP 层统一提示 */
  }
}

function formatTime(v: string) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

onMounted(fetchList);
</script>

<template>
  <div class="prompt-library">
    <LibraryHero />
    <section aria-label="Prompt 资源库">
      <div class="collection-header">
        <div>
          <h2>
            我的 Prompt <span>{{ total }}</span>
          </h2>
          <p>好用的想法，值得被留下。</p>
        </div>
        <el-button type="primary" @click="router.push('/prompts/new')"
          ><AppIcon name="plus" :size="16" />&nbsp; 新建 Prompt</el-button
        >
      </div>
      <div class="collection-toolbar">
        <form @submit.prevent="onSearch">
          <el-input
            v-model="keyword"
            aria-label="搜索 Prompt"
            placeholder="搜索名称或描述…"
            clearable
            @clear="onSearch"
            ><template #prefix
              ><AppIcon name="search" :size="16" /></template></el-input
          ><el-button native-type="submit" :loading="loading">搜索</el-button>
        </form>
        <div class="view-switch" role="group" aria-label="展示方式">
          <button
            :class="{ selected: viewMode === 'grid' }"
            :aria-pressed="viewMode === 'grid'"
            aria-label="卡片视图"
            @click="viewMode = 'grid'"
          >
            <AppIcon name="grid" :size="17" /></button
          ><button
            :class="{ selected: viewMode === 'list' }"
            :aria-pressed="viewMode === 'list'"
            aria-label="列表视图"
            @click="viewMode = 'list'"
          >
            <AppIcon name="list" :size="18" />
          </button>
        </div>
      </div>
      <LoadError v-if="error" :message="error" @retry="fetchList" />
      <div
        v-else
        v-loading="loading"
        class="collection-content"
        :aria-busy="loading"
      >
        <div v-if="list.length && viewMode === 'grid'" class="prompt-grid">
          <PromptCard
            v-for="prompt in list"
            :key="prompt.id"
            :prompt="prompt"
            :updated="formatTime(prompt.updatedAt)"
            @open="goWorkspace(prompt)"
            @copy="copyTemplate(prompt)"
            @remove="onDelete(prompt)"
          />
        </div>
        <el-table v-else-if="list.length" :data="list" class="prompt-table"
          ><el-table-column prop="name" label="名称" min-width="180"
            ><template #default="{ row }"
              ><button class="table-link" @click="goWorkspace(row)">
                {{ row.name }}
              </button></template
            ></el-table-column
          ><el-table-column
            prop="description"
            label="描述"
            min-width="200"
            show-overflow-tooltip
          /><el-table-column label="版本" width="75"
            ><template #default="{ row }"
              >v{{ row.currentVersion }}</template
            ></el-table-column
          ><el-table-column label="最近更新" width="130"
            ><template #default="{ row }">{{
              formatTime(row.updatedAt)
            }}</template></el-table-column
          ><el-table-column label="操作" width="160" fixed="right"
            ><template #default="{ row }"
              ><el-button link type="primary" @click="goWorkspace(row)"
                >打开</el-button
              ><el-button link @click="copyTemplate(row)">复制</el-button
              ><el-button link type="danger" @click="onDelete(row)"
                >删除</el-button
              ></template
            ></el-table-column
          ></el-table
        >
        <div v-else-if="!loading" class="collection-empty">
          <AppIcon name="prompt" :size="32" />
          <h3>
            {{ keyword ? "没有找到匹配的 Prompt" : "给好想法，一个开始" }}
          </h3>
          <p>
            {{
              keyword
                ? "试试其他关键词，或清空搜索条件。"
                : "创建第一个 Prompt，开始积累你的创作工具箱。"
            }}
          </p>
          <el-button v-if="!keyword" @click="router.push('/prompts/new')"
            >创建 Prompt <AppIcon name="arrow-up-right" :size="16" /></el-button
          ><el-button
            v-else
            @click="
              keyword = '';
              onSearch();
            "
            >清空搜索</el-button
          >
        </div>
      </div>
      <div v-if="total > pageSize" class="pagination">
        <el-pagination
          background
          layout="prev, pager, next"
          :pager-count="5"
          :current-page="page"
          :page-size="pageSize"
          :total="total"
          @current-change="onPageChange"
        />
      </div>
    </section>
  </div>
</template>
<style scoped>
.prompt-library {
  max-width: 1180px;
  margin: auto;
}
.collection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  border-top: 1px solid var(--app-line);
  padding-top: 28px;
}
.collection-header h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 550;
  margin: 0;
}
.collection-header h2 span {
  border: 1px solid var(--app-line);
  padding: 2px 7px;
  border-radius: 6px;
  font: 11px var(--font-mono);
  color: var(--app-muted);
}
.collection-header p {
  font-size: 12px;
  color: var(--app-muted);
  margin: 8px 0 0;
}
.collection-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 24px 0 20px;
}
.collection-toolbar form {
  display: flex;
  gap: 8px;
  width: 340px;
  max-width: calc(100% - 86px);
}
.collection-toolbar :deep(.el-input__wrapper) {
  background: var(--app-surface);
  box-shadow: none;
}
.view-switch {
  display: flex;
  padding: 3px;
  background: var(--app-surface);
  border-radius: 8px;
  gap: 2px;
}
.view-switch button {
  display: grid;
  place-items: center;
  width: 33px;
  height: 30px;
  border: 0;
  border-radius: 5px;
  background: none;
  color: var(--app-muted);
}
.view-switch button.selected {
  background: var(--app-bg);
  color: var(--el-color-primary);
  box-shadow: 0 1px 4px #0000000d;
}
.collection-content {
  min-height: 200px;
}
.prompt-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.table-link {
  border: 0;
  background: none;
  color: var(--app-text);
  text-align: left;
}
.table-link:hover {
  color: var(--el-color-primary);
}
.collection-empty {
  padding: 55px 15px;
  text-align: center;
  border: 1px dashed var(--app-line);
  border-radius: 16px;
  color: var(--app-muted);
}
.collection-empty h3 {
  color: var(--app-text);
  font-size: 16px;
  font-weight: 500;
}
.collection-empty p {
  font-size: 13px;
  line-height: 1.8;
}
.pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 24px;
}
@media (max-width: 1200px) {
  .prompt-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 600px) {
  .prompt-grid {
    grid-template-columns: 1fr;
  }
  .collection-header h2 {
    font-size: 16px;
  }
  .view-switch button {
    min-height: 38px;
  }
  .collection-toolbar form {
    max-width: calc(100% - 92px);
  }
}
</style>
