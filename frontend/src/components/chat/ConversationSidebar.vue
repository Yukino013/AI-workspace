<script setup lang="ts">
import { computed, shallowRef } from "vue";
import type { Conversation } from "@/types";
import AppIcon from "@/components/common/AppIcon.vue";
const props = defineProps<{
  conversations: Conversation[];
  activeId?: string;
  busy: boolean;
}>();
defineEmits<{
  open: [item: Conversation];
  remove: [item: Conversation];
  create: [];
}>();
const keyword = shallowRef("");
const filtered = computed(() =>
  props.conversations.filter((item) =>
    item.title.toLowerCase().includes(keyword.value.toLowerCase()),
  ),
);
</script>
<template>
  <aside class="sessions">
    <header>
      <strong
        >我的会话 <small>{{ conversations.length }}</small></strong
      ><el-button size="small" :loading="busy" @click="$emit('create')"
        ><AppIcon name="plus" :size="15" /> 新建</el-button
      >
    </header>
    <el-input
      v-model="keyword"
      aria-label="搜索会话"
      placeholder="搜索会话…"
      clearable
      ><template #prefix><AppIcon name="search" :size="15" /></template
    ></el-input>
    <div class="session-list">
      <div
        v-for="item in filtered"
        :key="item.id"
        class="session-row"
        :class="{ active: activeId === item.id }"
      >
        <button
          class="session-open"
          :disabled="busy"
          :aria-current="activeId === item.id ? 'true' : undefined"
          @click="$emit('open', item)"
        >
          <AppIcon name="chat" :size="16" /><span>{{
            item.title
          }}</span></button
        ><button
          class="session-delete"
          :disabled="busy"
          :aria-label="`删除会话 ${item.title}`"
          @click="$emit('remove', item)"
        >
          ×
        </button>
      </div>
      <p v-if="!filtered.length" class="empty">
        {{ keyword ? "未找到匹配的会话" : "创建会话，开始新的思考" }}
      </p>
    </div>
    <footer>对话自动保存，可在历史记录中复用</footer>
  </aside>
</template>
<style scoped>
.sessions {
  padding: 18px 12px;
  background: var(--app-bg);
  border: 1px solid var(--el-border-color-light);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 2px 18px;
  gap: 8px;
}
header strong {
  font-size: 13px;
}
header small {
  font-size: 10px;
  font-weight: 400;
  color: var(--app-muted);
  margin-left: 5px;
}
.session-list {
  flex: 1;
  overflow: auto;
  margin-top: 16px;
}
.session-row {
  display: flex;
  align-items: center;
  gap: 2px;
  border-radius: 8px;
  margin-bottom: 5px;
}
.session-row:hover {
  background: var(--app-surface);
}
.session-row.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.session-open {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  background: none;
  border: 0;
  color: inherit;
  padding: 13px 10px;
  text-align: left;
  font-size: 12px;
}
.session-open > .app-icon {
  flex-shrink: 0;
}
.session-open span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.session-delete {
  border: 0;
  background: transparent;
  color: var(--app-muted);
  font-size: 20px;
  width: 30px;
  height: 36px;
  flex-shrink: 0;
}
.session-delete:hover {
  color: var(--el-color-danger);
}
.empty {
  font-size: 12px;
  line-height: 1.7;
  color: var(--app-muted);
  text-align: center;
  padding: 28px 0;
}
footer {
  padding-top: 16px;
  color: var(--app-muted);
  font-size: 10px;
  line-height: 1.8;
}
@media (max-width: 760px) {
  .sessions {
    max-height: 230px;
  }
  footer {
    display: none;
  }
  .session-delete {
    width: 44px;
    height: 44px;
  }
}
</style>
