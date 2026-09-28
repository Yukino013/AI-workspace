<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import { workspaceLinks } from "@/utils/navigation";
import AppIcon from "@/components/common/AppIcon.vue";
const visible = defineModel<boolean>({ required: true });
const router = useRouter();
const query = ref("");
const selected = ref(0);
const input = ref<HTMLInputElement>();
const results = computed(() =>
  workspaceLinks.filter((item) =>
    `${item.label} ${item.description}`
      .toLowerCase()
      .includes(query.value.trim().toLowerCase()),
  ),
);
watch(query, () => (selected.value = 0));
watch(selected, async (index) => {
  await nextTick();
  document
    .getElementById(`command-${index}`)
    ?.scrollIntoView({ block: "nearest" });
});
watch(visible, (value) => {
  if (value) {
    query.value = "";
    selected.value = 0;
  }
});
async function focusInput() {
  await nextTick();
  input.value?.focus();
}
function navigate(path: string) {
  visible.value = false;
  void router.push(path);
}
function onKey(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const count = results.value.length;
    if (count)
      selected.value =
        (selected.value + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const item = results.value[selected.value];
    if (item) navigate(item.path);
  }
}
function shortcut(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    visible.value = !visible.value;
  }
}
onMounted(() => window.addEventListener("keydown", shortcut));
onBeforeUnmount(() => window.removeEventListener("keydown", shortcut));
</script>
<template>
  <el-dialog
    v-model="visible"
    title="快速前往"
    width="560px"
    class="command-dialog"
    :show-close="false"
    @opened="focusInput"
  >
    <div class="command-search">
      <AppIcon name="search" /><input
        ref="input"
        v-model="query"
        placeholder="搜索功能与页面…"
        aria-label="搜索功能与页面"
        role="combobox"
        aria-controls="command-results"
        aria-expanded="true"
        :aria-activedescendant="
          results[selected] ? `command-${selected}` : undefined
        "
        @keydown="onKey"
      /><button
        class="escape"
        aria-label="关闭快捷搜索"
        @click="visible = false"
      >
        esc
      </button>
    </div>
    <div
      id="command-results"
      role="listbox"
      aria-label="页面"
      class="command-results"
    >
      <button
        v-for="(item, index) in results"
        :id="`command-${index}`"
        :key="item.path"
        role="option"
        tabindex="-1"
        :aria-selected="selected === index"
        :class="{ selected: selected === index }"
        @click="navigate(item.path)"
        @pointermove="selected = index"
        @keydown="onKey"
      >
        <AppIcon :name="item.icon" /><span
          ><strong>{{ item.label }}</strong
          ><small>{{ item.description }}</small></span
        ><AppIcon name="arrow-up-right" :size="16" />
      </button>
      <p v-if="!results.length" class="no-result">
        没有匹配的页面，试试「对话」或「代码」。
      </p>
    </div>
    <div class="command-footer">
      <span>↑ ↓ 选择</span><span>↵ 打开</span><span>⌘ / Ctrl + K 快速搜索</span>
    </div>
  </el-dialog>
</template>
<style scoped>
.command-search {
  display: flex;
  gap: 14px;
  align-items: center;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--app-line);
  color: var(--app-muted);
}
.command-search input {
  border: 0;
  background: transparent;
  color: var(--app-text);
  flex: 1;
  min-width: 0;
  font-size: 16px;
  outline: none;
}
.escape {
  border: 1px solid var(--app-line);
  color: var(--app-muted);
  background: var(--app-surface);
  border-radius: 5px;
  padding: 4px 7px;
  font-size: 11px;
}
.command-results {
  padding-block: 12px;
  max-height: 55dvh;
  overflow: auto;
}
.command-results button {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  border: 0;
  padding: 12px;
  border-radius: 10px;
  background: transparent;
  color: var(--app-muted);
  text-align: left;
}
.command-results button.selected {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.command-results button span {
  flex: 1;
}
strong {
  color: var(--app-text);
  font-size: 13px;
  font-weight: 500;
}
small {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--app-muted);
}
.command-footer {
  border-top: 1px solid var(--app-line);
  padding-top: 14px;
  display: flex;
  gap: 16px;
  font-size: 10px;
  color: var(--app-muted);
}
.command-footer span:last-child {
  margin-left: auto;
}
.no-result {
  text-align: center;
  color: var(--app-muted);
  padding: 28px 0;
  font-size: 13px;
}
.command-search:focus-within {
  border-bottom-color: var(--el-color-primary);
}
@media (max-width: 600px) {
  .escape {
    min-width: 44px;
    min-height: 44px;
  }
  .command-footer {
    flex-wrap: wrap;
    gap: 10px;
  }
  .command-footer span:last-child {
    margin-left: 0;
  }
}
</style>
