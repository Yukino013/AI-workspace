<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

type ThemeMode = "light" | "dark";

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const theme = shallowRef<ThemeMode>("light");

const activeMenu = computed(() => {
  if (route.path.startsWith("/prompts/")) return "/prompts/new";
  if (route.path === "/prompts") return "/prompts";
  if (route.path === "/call-records") return "/call-records";
  if (route.path === "/providers") return "/providers";
  if (route.path === "/chat") return "/chat";
  if (route.path === "/code-tools") return "/code-tools";
  if (route.path === "/history") return "/history";
  return "/prompts";
});

const displayName = computed(() => auth.user?.nickname || auth.user?.username || "");
const avatarInitial = computed(() => (displayName.value.charAt(0) || "U").toUpperCase());

function goProfile() {
  router.push("/profile");
}

function applyTheme(mode: ThemeMode) {
  theme.value = mode;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.setAttribute("data-theme", mode);
  root.style.colorScheme = mode;
  localStorage.setItem("theme-mode", mode);
}

function toggleTheme() {
  applyTheme(theme.value === "dark" ? "light" : "dark");
}

function logout() {
  auth.logout();
  router.push("/login");
}

onMounted(() => {
  const savedTheme = localStorage.getItem("theme-mode") as ThemeMode | null;
  applyTheme(savedTheme === "dark" ? "dark" : "light");
});
</script>

<template>
  <el-container class="app">
    <el-header v-if="auth.token" class="header">
      <div class="brand">AI 工作台</div>
      <el-menu mode="horizontal" :default-active="activeMenu" :ellipsis="false" router>
        <el-menu-item index="/prompts">Prompt 管理</el-menu-item>
        <el-menu-item index="/prompts/new">Prompt 工作台</el-menu-item>
        <el-menu-item index="/call-records">调用历史</el-menu-item>
        <el-menu-item index="/providers">Provider 配置</el-menu-item>
        <el-menu-item index="/chat">AI 对话</el-menu-item>
        <el-menu-item index="/code-tools">代码工具</el-menu-item>
        <el-menu-item index="/history">历史记录</el-menu-item>
      </el-menu>
      <div class="user">
        <el-tooltip content="我的" placement="bottom">
          <el-avatar
            class="user-avatar"
            :size="28"
            :src="auth.user?.avatar || undefined"
            @click="goProfile"
          >
            {{ avatarInitial }}
          </el-avatar>
        </el-tooltip>
        <span class="username" @click="goProfile">{{ displayName }}</span>
        <el-button class="theme-toggle" link @click="toggleTheme">
          {{ theme === "dark" ? "白色主题" : "黑色主题" }}
        </el-button>
        <el-button link type="primary" @click="logout">退出</el-button>
      </div>
    </el-header>
    <el-main class="main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
:global(:root) {
  color-scheme: light;
  --app-bg: #ffffff;
  --app-surface: #f7f8fa;
  --app-text: #1f2937;
  --app-muted: #606266;
  /* 技术风强调色 */
  --tech-cyan: #06b6d4;
  --tech-violet: #7c3aed;
  --tech-green: #10b981;
  /* 代码编辑器（深色 IDE 风，light/dark 下保持一致） */
  --code-bg: #1e1e2e;
  --code-border: #2d2d3d;
  --code-text: #e2e8f0;
  --code-muted: #8b949e;
  --code-placeholder: #64748b;
  --code-accent: #22d3ee;
  --code-accent-bg: rgba(34, 211, 238, 0.14);
}

:global(:root.dark) {
  color-scheme: dark;
  --app-bg: #0f172a;
  --app-surface: #111827;
  --app-text: #f8fafc;
  --app-muted: #cbd5e1;
}

:global(body) {
  margin: 0;
  background: var(--app-bg);
  color: var(--app-text);
}

.app {
  height: 100vh;
  background: var(--app-bg);
  color: var(--app-text);
}
.header {
  display: flex;
  align-items: center;
  gap: 24px;
  border-bottom: 1px solid var(--el-border-color-light);
  background: var(--app-bg);
  color: var(--app-text);
}
.brand {
  font-weight: 600;
  white-space: nowrap;
  color: var(--app-text);
}
.header :deep(.el-menu) {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
}
.user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.username {
  color: var(--app-muted);
  cursor: pointer;
}
.user-avatar {
  cursor: pointer;
  flex-shrink: 0;
}
.theme-toggle {
  color: var(--app-text);
}
.main {
  background: var(--app-surface);
  color: var(--app-text);
}
</style>

<!-- AI 输出的 Markdown 基础样式（全局，非 scoped） -->
<style>
.markdown-body pre {
  background: #f6f8fa;
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
}
.markdown-body code {
  background: #f6f8fa;
  padding: 2px 4px;
  border-radius: 4px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92em;
}
.markdown-body pre code {
  background: none;
  padding: 0;
}
.markdown-body table {
  border-collapse: collapse;
  width: 100%;
}
.markdown-body th,
.markdown-body td {
  border: 1px solid var(--el-border-color-light);
  padding: 6px 12px;
}

:root.dark .markdown-body pre,
:root.dark .markdown-body code {
  background: #111827;
  color: #f8fafc;
}

:root.dark .markdown-body th,
:root.dark .markdown-body td {
  border-color: var(--el-border-color-light);
}
</style>
