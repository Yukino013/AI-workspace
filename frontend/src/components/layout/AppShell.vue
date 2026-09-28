<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, shallowRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/composables/useTheme";
import AppIcon from "@/components/common/AppIcon.vue";
import BrandMark from "@/components/common/BrandMark.vue";
import CommandPalette from "./CommandPalette.vue";
import WhalePet from "@/components/pet/WhalePet.vue";
import WhaleAvatar from "@/components/pet/WhaleAvatar.vue";
import { workspaceLinks as links } from "@/utils/navigation";
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const { theme, toggle } = useTheme();
const mobileOpen = shallowRef(false);
const media = matchMedia("(max-width: 760px)");
const isMobile = shallowRef(media.matches);
const sidebar = shallowRef<HTMLElement>();
const menuButton = shallowRef<HTMLButtonElement>();
const whalePet = shallowRef<InstanceType<typeof WhalePet>>();
const whaleToggle = shallowRef<HTMLButtonElement>();
function resize() {
  isMobile.value = media.matches;
  if (!media.matches) mobileOpen.value = false;
}
media.addEventListener("change", resize);
onBeforeUnmount(() => media.removeEventListener("change", resize));
watch(mobileOpen, async (open) => {
  await nextTick();
  if (open) sidebar.value?.focus();
  else if (isMobile.value && !commandOpen.value) menuButton.value?.focus();
});
function trapNavigation(event: KeyboardEvent) {
  if (!isMobile.value || !mobileOpen.value) return;
  if (event.key === "Escape") {
    mobileOpen.value = false;
    return;
  }
  if (event.key !== "Tab") return;
  const elements = [
    ...(sidebar.value?.querySelectorAll<HTMLElement>(
      "a[href], button:not([disabled])",
    ) || []),
  ].filter((element) => element.getClientRects().length > 0);
  if (!elements?.length) return;
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      document.activeElement === sidebar.value)
  ) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}
const collapsed = shallowRef(false);
const commandOpen = shallowRef(false);
watch(commandOpen, (open) => {
  if (open) mobileOpen.value = false;
});
const activePath = computed(() =>
  route.path.startsWith("/prompts/") ? "/prompts/new" : route.path,
);
const title = computed(
  () =>
    links.find((item) => item.path === activePath.value)?.label || "个人设置",
);
const name = computed(
  () => auth.user?.nickname || auth.user?.username || "开发者",
);
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false;
  },
);
function logout() {
  auth.logout();
  router.push("/login");
}
</script>
<template>
  <div
    class="workspace-shell"
    :class="{ 'is-collapsed': collapsed && !isMobile }"
    @keydown="trapNavigation"
  >
    <a class="skip-link" href="#main-content">跳转到主内容</a>
    <button
      v-if="mobileOpen"
      class="nav-backdrop"
      aria-label="关闭导航"
      @click="mobileOpen = false"
    />
    <aside
      ref="sidebar"
      class="sidebar"
      :class="{ 'is-open': mobileOpen }"
      :inert="isMobile && !mobileOpen"
      :aria-hidden="isMobile && !mobileOpen"
      tabindex="-1"
      aria-label="主导航"
    >
      <div class="brand-row">
        <router-link to="/prompts" class="brand" aria-label="AI 工作台首页"
          ><BrandMark :size="32" /><span class="brand-label"
            >AI 工作台<small>MAKE ROOM FOR IDEAS</small></span
          ></router-link
        ><button
          v-if="isMobile"
          class="icon-button"
          aria-label="关闭导航"
          @click="mobileOpen = false"
        >
          <AppIcon name="close" />
        </button>
      </div>
      <router-link
        to="/prompts/new"
        class="new-work"
        aria-label="新建 Prompt"
        :title="collapsed ? '新建 Prompt' : undefined"
        ><AppIcon name="plus" :size="18" /><span>新建 Prompt</span
        ><kbd>＋</kbd></router-link
      >
      <nav class="main-nav" aria-label="工作空间导航">
        <template v-for="item in links" :key="item.path"
          ><p v-if="'section' in item" class="nav-label">{{ item.section }}</p>
          <router-link
            :to="item.path"
            class="nav-item"
            :class="{ selected: activePath === item.path }"
            :aria-current="activePath === item.path ? 'page' : undefined"
            :aria-label="item.label"
            :title="collapsed ? item.label : undefined"
            ><AppIcon :name="item.icon" :size="18" /><span>{{
              item.label
            }}</span
            ><span
              v-if="activePath === item.path"
              class="active-dot" /></router-link
        ></template>
      </nav>
      <div class="sidebar-bottom">
        <router-link to="/providers" class="model-connect"
          ><span class="connect-symbol"
            ><AppIcon name="sparkles" :size="19"
          /></span>
          <div>
            <strong>让灵感，多一种可能</strong><small>连接你的 AI 模型</small>
          </div>
          <AppIcon name="arrow-up-right" :size="15"
        /></router-link>
        <router-link
          to="/profile"
          class="account"
          :title="name"
          :aria-label="`${name}，个人设置`"
          ><el-avatar :size="32" :src="auth.user?.avatar || undefined">{{
            name.charAt(0).toUpperCase()
          }}</el-avatar
          ><span>{{ name }}<small>个人工作空间</small></span
          ><AppIcon name="chevron-right" :size="15"
        /></router-link>
        <div class="sidebar-foot">
          <span>DESIGNED FOR YOUR FLOW</span
          ><button
            class="icon-button"
            :aria-label="collapsed ? '展开侧栏' : '收起侧栏'"
            :aria-expanded="!collapsed"
            @click="collapsed = !collapsed"
          >
            <AppIcon name="panel" :size="16" />
          </button>
        </div>
      </div>
    </aside>
    <div class="workspace-body" :inert="isMobile && mobileOpen">
      <header class="topbar">
        <div class="topbar-location">
          <button
            ref="menuButton"
            class="icon-button mobile-menu"
            aria-label="切换导航"
            :aria-expanded="mobileOpen"
            @click="mobileOpen = !mobileOpen"
          >
            <AppIcon name="panel" /></button
          ><span class="breadcrumb"
            ><span class="breadcrumb-prefix">工作空间 /</span>
            <strong>{{ title }}</strong></span
          >
        </div>
        <div class="topbar-actions">
          <button
            ref="whaleToggle"
            class="icon-button whale-toggle"
            aria-label="显示或收起鲸鱼桌宠"
            title="DeepSeek 大肥鲸"
            :aria-pressed="whalePet?.visible ?? false"
            @click="whalePet?.toggle()"
          >
            <WhaleAvatar :animated="false" />
          </button>
          <button
            class="quick-search"
            aria-label="快捷搜索（Command 或 Control 加 K）"
            @click="commandOpen = true"
          >
            <AppIcon name="search" :size="15" /><span>快速前往</span
            ><kbd>⌘ K</kbd></button
          ><span class="action-divider" /><button
            class="icon-button"
            :aria-label="theme === 'dark' ? '切换浅色主题' : '切换深色主题'"
            @click="toggle"
          >
            <AppIcon
              :name="theme === 'dark' ? 'sun' : 'moon'"
              :size="18"
            /></button
          ><button class="icon-button" aria-label="退出登录" @click="logout">
            <AppIcon name="logout" :size="18" />
          </button>
        </div>
      </header>
      <main
        id="main-content"
        class="main-content"
        :class="{ 'is-chat': route.path === '/chat' }"
        tabindex="-1"
      >
        <slot />
      </main>
    </div>
    <CommandPalette v-model="commandOpen" />
    <WhalePet
      ref="whalePet"
      :suspended="mobileOpen || commandOpen"
      @hide="whaleToggle?.focus()"
    />
  </div>
</template>
<style scoped>
.workspace-shell {
  --sidebar-width: 224px;
  min-height: 100dvh;
  display: flex;
}
.workspace-shell.is-collapsed {
  --sidebar-width: 76px;
}
.sidebar {
  width: var(--sidebar-width);
  position: fixed;
  inset: 0 auto 0 0;
  background: var(--app-sidebar);
  display: flex;
  flex-direction: column;
  padding: 30px 16px 12px;
  z-index: 30;
  overflow: auto;
}
.brand-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  min-height: 40px;
}
.brand {
  display: flex;
  gap: 10px;
  align-items: center;
  color: var(--el-color-primary);
  text-decoration: none;
  flex-shrink: 0;
}
.brand-label {
  color: var(--app-text);
  font-size: 19px;
  letter-spacing: -0.7px;
  font-weight: 650;
}
.brand small {
  display: block;
  color: var(--app-muted);
  font-size: 7px;
  letter-spacing: 1.2px;
  margin-top: 4px;
  font-weight: 500;
}
.new-work {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 32px 0 16px;
  padding: 12px;
  border: 1px solid var(--el-border-color);
  color: var(--app-text);
  background: var(--app-bg);
  text-decoration: none;
  border-radius: 11px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 3px #192e4f03;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
.new-work:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: var(--app-shadow);
}
kbd {
  font-family: inherit;
  font-size: 11px;
  color: var(--app-muted);
}
.new-work kbd {
  margin-left: auto;
}
.nav-label {
  margin: 22px 12px 10px;
  font-size: 10px;
  letter-spacing: 1px;
  color: var(--app-muted);
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 44px;
  margin: 3px 0;
  padding: 0 13px;
  border-radius: 9px;
  color: var(--el-text-color-regular);
  font-size: 13px;
  text-decoration: none;
  transition:
    background 0.18s,
    color 0.18s;
}
.nav-item:hover {
  background: var(--app-hover);
  color: var(--app-text);
}
.nav-item.selected {
  background: var(--app-bg);
  color: var(--el-color-primary);
  box-shadow: 0 2px 7px #23324d05;
  font-weight: 550;
}
.active-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  margin-left: auto;
}
.sidebar-bottom {
  margin-top: auto;
  padding-top: 40px;
}
.model-connect {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  padding: 15px 10px;
  border-bottom: 1px solid var(--el-border-color);
  color: var(--app-muted);
  margin-bottom: 14px;
}
.connect-symbol {
  color: var(--el-color-primary);
}
.model-connect div {
  flex: 1;
}
.model-connect strong {
  color: var(--app-text);
  font-size: 11px;
  font-weight: 500;
}
.model-connect small {
  display: block;
  font-size: 10px;
  margin-top: 5px;
}
.model-connect:hover strong {
  color: var(--el-color-primary);
}
.account {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 9px;
  color: var(--app-text);
  text-decoration: none;
  font-size: 12px;
}
.account:hover {
  background: var(--app-hover);
}
.account > span:nth-child(2) {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.account small {
  display: block;
  color: var(--app-muted);
  font-size: 10px;
  margin-top: 4px;
}
.account :deep(.el-avatar) {
  background: var(--app-bg);
  color: var(--el-color-primary);
  border: 1px solid var(--app-line);
  font-weight: 600;
}
.sidebar-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 4px 0 10px;
  color: var(--app-muted);
  font-size: 7px;
  letter-spacing: 0.8px;
}
.workspace-body {
  margin: 12px 12px 12px var(--sidebar-width);
  background: var(--app-bg);
  border: 1px solid var(--app-line);
  border-radius: 20px;
  flex: 1;
  min-width: 0;
  min-height: calc(100dvh - 24px);
}
.topbar {
  height: 70px;
  padding: 0 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.topbar-location {
  display: flex;
  align-items: center;
  min-width: 0;
}
.breadcrumb {
  color: var(--app-muted);
  font-size: 11px;
  white-space: nowrap;
}
.breadcrumb > span {
  padding: 0 10px;
  opacity: 0.4;
}
.breadcrumb strong {
  font-weight: 500;
  color: var(--el-text-color-regular);
}
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.whale-toggle :deep(.whale-art) {
  width: 30px;
  height: 28px;
}
.whale-toggle[aria-pressed="true"] {
  background: var(--el-color-primary-light-9);
}
.quick-search {
  display: flex;
  align-items: center;
  gap: 9px;
  border: 0;
  background: none;
  color: var(--app-muted);
  border-radius: 8px;
  padding: 8px;
  font-size: 11px;
}
.quick-search:hover {
  background: var(--app-surface);
}
.quick-search kbd {
  font-size: 9px;
  border: 1px solid var(--app-line);
  border-radius: 4px;
  padding: 2px 4px;
  margin-left: 12px;
}
.action-divider {
  width: 1px;
  height: 14px;
  background: var(--app-line);
  margin: 0 10px;
}
.main-content {
  padding: 26px 48px 44px;
  width: 100%;
  max-width: 1440px;
  margin: auto;
  animation: enter-view 0.35s ease both;
}
.main-content.is-chat {
  max-width: none;
  padding: 0 28px 24px;
}
.mobile-menu {
  display: none;
}
.nav-backdrop {
  position: fixed;
  inset: 0;
  background: #10152466;
  border: 0;
  z-index: 29;
  backdrop-filter: blur(3px);
}
.skip-link {
  position: fixed;
  top: -70px;
  left: 250px;
  z-index: 100;
  background: var(--app-bg);
  padding: 12px;
}
.skip-link:focus {
  top: 10px;
}
.is-collapsed .brand-label,
.is-collapsed .new-work span,
.is-collapsed .new-work kbd,
.is-collapsed .nav-item > span,
.is-collapsed .model-connect,
.is-collapsed .account > span:nth-child(2),
.is-collapsed .account > .app-icon,
.is-collapsed .sidebar-foot > span {
  display: none;
}
.is-collapsed .sidebar {
  padding-inline: 12px;
}
.is-collapsed .brand-row {
  padding: 0;
  justify-content: center;
}
.is-collapsed .new-work,
.is-collapsed .nav-item,
.is-collapsed .account {
  justify-content: center;
  padding-inline: 0;
}
.is-collapsed .nav-label {
  font-size: 0;
  height: 1px;
  background: var(--el-border-color);
  margin: 24px 10px 14px;
}
.is-collapsed .sidebar-foot {
  padding-inline: 0;
  justify-content: center;
}
@media (max-width: 1100px) {
  .workspace-shell {
    --sidebar-width: 202px;
  }
  .main-content {
    padding-inline: 30px;
  }
  .sidebar {
    padding-inline: 12px;
  }
  .topbar {
    padding-inline: 26px;
  }
}
@media (max-width: 760px) {
  .workspace-body {
    margin: 0;
    border: 0;
    border-radius: 0;
    min-height: 100dvh;
  }
  .sidebar {
    transform: translateX(-100%);
    width: 260px;
    transition: transform 0.2s ease;
    padding: 22px 16px;
  }
  .sidebar.is-open {
    transform: translateX(0);
  }
  .sidebar-foot {
    display: none;
  }
  .mobile-menu {
    display: grid;
    margin-left: -8px;
  }
  .topbar {
    height: 64px;
    padding: 0 16px;
    gap: 4px;
    border-bottom: 1px solid var(--app-line);
  }
  .quick-search {
    width: 36px;
    justify-content: center;
  }
  .quick-search span,
  .quick-search kbd,
  .action-divider {
    display: none;
  }
  .topbar-actions {
    gap: 0;
  }
  .breadcrumb {
    font-size: 10px;
  }
  .breadcrumb-prefix {
    display: none;
  }
  .main-content,
  .main-content.is-chat {
    padding: 24px 18px;
  }
  .main-content.is-chat {
    padding: 12px;
  }
  .skip-link {
    left: 12px;
  }
}
</style>
