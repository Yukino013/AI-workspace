<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from "vue";
import BrandMark from "@/components/common/BrandMark.vue";
import AppIcon from "@/components/common/AppIcon.vue";
import GenerationActions from "./GenerationActions.vue";
import type { CodeToolRunContext } from "@/utils/code-tool-export";
import { md } from "@/utils/markdown";
const props = defineProps<{
  output: string;
  reasoning: string;
  running: boolean;
  error: string;
  stopped: boolean;
  context: CodeToolRunContext;
}>();
const html = computed(() => md.render(props.output));
const report = computed(() => ({ ...props.context, output: props.output, reasoning: props.reasoning,
  running: props.running, stopped: props.stopped, error: props.error }));
const reasoningOpen = shallowRef(false);
const following = shallowRef(true);
const pageFollowing = shallowRef(true);
const stacked = shallowRef(false);
const pageOutOfView = shallowRef(false);
const scrollProgress = shallowRef(100);
const reasoningText = useTemplateRef<HTMLElement>("reasoningText");
const reasoningSection = useTemplateRef<HTMLElement>("reasoningSection");
let stackedQuery: MediaQueryList | undefined;
let expectedPageScrollY = 0;

function updatePageVisibility() {
  const section = reasoningSection.value;
  if (!section || !stacked.value || !props.running) {
    pageOutOfView.value = false;
    return;
  }
  const bounds = section.getBoundingClientRect();
  pageOutOfView.value = bounds.bottom < 72 || bounds.top > window.innerHeight - 48;
}

function followPage() {
  const section = reasoningSection.value;
  if (!section || !stacked.value || !pageFollowing.value || !reasoningOpen.value) return;
  const bounds = section.getBoundingClientRect();
  const available = window.innerHeight - 96;
  const distance = bounds.height > available
    ? bounds.top - 72
    : bounds.bottom > window.innerHeight - 24
      ? bounds.bottom - window.innerHeight + 24
      : bounds.top < 72 ? bounds.top - 72 : 0;
  if (Math.abs(distance) > 1) {
    expectedPageScrollY = Math.max(0, Math.min(
      window.scrollY + distance,
      document.documentElement.scrollHeight - window.innerHeight,
    ));
    window.scrollBy(0, distance);
  }
  updatePageVisibility();
}

function pausePageFollowing(event: Event) {
  if (!stacked.value || !props.running || !pageFollowing.value) return;
  const target = event.target;
  if (target instanceof Element && target.closest(".reasoning-text")) return;
  if (event instanceof KeyboardEvent && target instanceof Element &&
    target.closest("input, textarea, select, button, [contenteditable='true']")) return;
  if (event instanceof KeyboardEvent && !["PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End", " "].includes(event.key)) return;
  pageFollowing.value = false;
  updatePageVisibility();
}

function togglePageFollowing() {
  pageFollowing.value = !pageFollowing.value;
  if (pageFollowing.value) followPage();
}

async function returnToReasoning() {
  reasoningOpen.value = true;
  pageFollowing.value = true;
  following.value = true;
  await nextTick();
  jumpToLatest();
}

function syncLayout() {
  stacked.value = stackedQuery?.matches ?? false;
  expectedPageScrollY = window.scrollY;
  if (props.running && pageFollowing.value) followPage();
  updatePageVisibility();
}

function onPageScroll() {
  if (stacked.value && props.running && pageFollowing.value &&
    Math.abs(window.scrollY - expectedPageScrollY) > 3) {
    pageFollowing.value = false;
  }
  updatePageVisibility();
}

function onPageResize() {
  expectedPageScrollY = window.scrollY;
  if (props.running && pageFollowing.value) followPage();
  updatePageVisibility();
}

onMounted(() => {
  stackedQuery = window.matchMedia("(max-width: 1100px)");
  syncLayout();
  stackedQuery.addEventListener("change", syncLayout);
  window.addEventListener("wheel", pausePageFollowing, { passive: true, capture: true });
  window.addEventListener("touchmove", pausePageFollowing, { passive: true, capture: true });
  window.addEventListener("keydown", pausePageFollowing, true);
  expectedPageScrollY = window.scrollY;
  window.addEventListener("scroll", onPageScroll, { passive: true });
  window.addEventListener("resize", onPageResize);
});

onBeforeUnmount(() => {
  stackedQuery?.removeEventListener("change", syncLayout);
  window.removeEventListener("wheel", pausePageFollowing, true);
  window.removeEventListener("touchmove", pausePageFollowing, true);
  window.removeEventListener("keydown", pausePageFollowing, true);
  window.removeEventListener("scroll", onPageScroll);
  window.removeEventListener("resize", onPageResize);
});

function updateScrollProgress(element: HTMLElement) {
  const scrollable = element.scrollHeight - element.clientHeight;
  scrollProgress.value = scrollable > 0
    ? Math.min(100, Math.round((element.scrollTop / scrollable) * 100))
    : 100;
}

function onReasoningScroll() {
  const element = reasoningText.value;
  if (!element || !reasoningOpen.value) return;
  following.value = element.scrollHeight - element.clientHeight - element.scrollTop <= 12;
  updateScrollProgress(element);
}

function jumpToLatest() {
  following.value = true;
  if (reasoningText.value) {
    reasoningText.value.scrollTop = reasoningText.value.scrollHeight;
    updateScrollProgress(reasoningText.value);
  }
  if (pageFollowing.value) followPage();
}

watch(
  () => props.running,
  (running) => {
    if (running) {
      following.value = true;
      pageFollowing.value = true;
      expectedPageScrollY = window.scrollY;
      scrollProgress.value = 100;
      reasoningOpen.value = true;
    }
    if (!running && props.reasoning && !props.stopped && !props.error) reasoningOpen.value = false;
    updatePageVisibility();
  },
  { immediate: true },
);

watch(
  () => [props.reasoning, reasoningOpen.value, reasoningText.value] as const,
  () => {
    const element = reasoningText.value;
    if (!element || !reasoningOpen.value) return;
    if (following.value) element.scrollTop = element.scrollHeight;
    updateScrollProgress(element);
    if (props.running && pageFollowing.value) followPage();
  },
  { flush: "post" },
);

watch(
  () => [props.reasoning, reasoningOpen.value, stacked.value] as const,
  () => updatePageVisibility(),
  { flush: "post" },
);

</script>
<template>
  <section class="generation-output" :aria-busy="running">
    <header>
      <span class="output-heading">处理结果 <i v-if="running" class="stream-dot" /></span>
      <GenerationActions :report="report" />
    </header>
    <el-alert
      v-if="error"
      :title="error"
      type="error"
      :closable="false"
      show-icon
    />
    <section v-if="reasoning" ref="reasoningSection" class="reasoning-section" aria-label="AI 推理摘要">
      <button
        class="reasoning-toggle"
        type="button"
        :aria-expanded="reasoningOpen"
        aria-controls="reasoning-content"
        @click="reasoningOpen = !reasoningOpen"
      >
        <span class="reasoning-title">
          <span class="reasoning-icon" :class="{ 'is-running': running }">
            <AppIcon name="sparkles" :size="15" />
          </span>
          <span>{{ running ? "AI 正在分析" : "推理摘要" }}</span>
          <i v-if="running" class="reasoning-dot" aria-hidden="true" />
        </span>
        <span class="reasoning-action">
          {{ reasoningOpen ? "收起" : "展开" }}
          <AppIcon name="chevron-right" :size="15" />
        </span>
      </button>
      <div v-show="reasoningOpen" id="reasoning-content" class="reasoning-content">
        <p class="reasoning-disclaimer">
          仅展示模型服务返回的公开推理摘要，不代表隐藏思维链。
        </p>
        <div
          ref="reasoningText"
          class="reasoning-text"
          tabindex="0"
          aria-label="推理摘要内容"
          @scroll="onReasoningScroll"
        >{{ reasoning }}</div>
        <div v-if="running" class="reasoning-follow">
          <span class="follow-state" :class="{ 'is-paused': !following }">
            <i class="follow-indicator" aria-hidden="true" />
            {{ following ? "摘要跟随中" : "摘要已暂停" }}
          </span>
          <div class="follow-actions">
            <button v-if="!following" class="follow-jump" type="button" @click="jumpToLatest">
              <AppIcon name="arrow-up" :size="13" />
              跳至最新
            </button>
            <button
              v-if="stacked"
              class="page-follow-toggle"
              type="button"
              :aria-pressed="pageFollowing"
              @click="togglePageFollowing"
            >页面跟随 {{ pageFollowing ? "开" : "关" }}</button>
          </div>
        </div>
        <div v-if="running" class="reasoning-progress" aria-hidden="true">
          <span :style="{ width: `${scrollProgress}%` }" />
        </div>
      </div>
    </section>
    <div v-if="output" class="markdown-body result" v-html="html" />
    <div v-else-if="!reasoning" class="output-empty">
      <span class="output-symbol"><BrandMark :size="38" /></span>
      <h3>{{ running ? "正在处理你的代码" : "更好的代码，从这里开始" }}</h3>
      <p>
        {{
          running
            ? "结果将实时显示，请稍候…"
            : "选择场景并运行，AI 的建议会显示在这里。"
        }}
      </p>
    </div>
    <div v-else class="result-pending" role="status">
      <span class="pending-line" />
      <span>{{ running ? "正在整理最终结果…" : "暂无最终结果" }}</span>
    </div>
    <footer role="status">
      {{
        running
          ? "正在生成…"
          : error
            ? "生成失败，可修改输入后重试"
            : stopped
              ? "已停止 · 当前结果可能不完整"
              : output
                ? "生成完成 · 已保存至历史记录"
                : "AI 输出仅供参考，请在使用前验证"
      }}
    </footer>
    <button
      v-if="running && reasoning && stacked && pageOutOfView && !pageFollowing"
      class="reasoning-return"
      type="button"
      @click="returnToReasoning"
    >
      <AppIcon name="arrow-up" :size="16" />
      返回推理摘要
    </button>
  </section>
</template>
<style scoped>
.generation-output {
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--el-border-color-light);
  border-radius: 16px;
  background: var(--app-bg);
  overflow: hidden;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  min-height: 65px;
  border-bottom: 1px solid var(--el-border-color-light);
  font-size: 13px;
  font-weight: 600;
  gap: 8px;
  flex-wrap: wrap;
}
.output-heading { flex: 0 0 auto; }
.result {
  padding: 6px 22px 20px;
  flex: 1;
  max-height: 570px;
  overflow: auto;
}
.reasoning-section {
  margin: 16px 20px 0;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 22%, var(--el-border-color-light));
  border-radius: 12px;
  background: color-mix(in srgb, var(--el-color-primary-light-9) 52%, var(--app-bg));
  overflow: hidden;
}
.reasoning-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 48px;
  padding: 10px 13px;
  border: 0;
  background: transparent;
  color: var(--el-text-color-primary);
  cursor: pointer;
  text-align: left;
  transition: background-color 180ms ease;
}
.reasoning-toggle:hover {
  background: color-mix(in srgb, var(--el-color-primary) 7%, transparent);
}
.reasoning-toggle:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}
.reasoning-title,
.reasoning-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.reasoning-title {
  font-size: 12px;
  font-weight: 600;
}
.reasoning-action {
  color: var(--app-muted);
  font-size: 11px;
}
.reasoning-action .app-icon {
  transform: rotate(90deg);
  transition: transform 180ms ease;
}
.reasoning-toggle[aria-expanded="true"] .reasoning-action .app-icon {
  transform: rotate(-90deg);
}
.reasoning-icon {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);
}
.reasoning-icon.is-running {
  animation: reasoning-pulse 1.5s ease-in-out infinite;
}
.reasoning-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--el-color-primary);
  animation: reasoning-pulse 1.2s ease-in-out infinite;
}
.reasoning-content {
  padding: 0 13px 13px 45px;
}
.reasoning-disclaimer {
  margin: 0 0 8px;
  color: var(--app-muted);
  font-size: 10px;
  line-height: 1.55;
}
.reasoning-text {
  max-height: 210px;
  overflow: auto;
  color: var(--el-text-color-regular);
  font-family: var(--app-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.reasoning-text:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: -2px;
}
.reasoning-follow {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
  color: var(--app-muted);
  font-size: 10px;
}
.follow-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.follow-indicator {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-8);
}
.follow-state.is-paused .follow-indicator {
  background: var(--el-color-warning);
  box-shadow: 0 0 0 3px var(--el-color-warning-light-8);
}
.follow-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.page-follow-toggle {
  min-height: 30px;
  padding: 4px 8px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--app-bg);
  color: var(--el-text-color-regular);
  font-size: 11px;
  cursor: pointer;
}
.page-follow-toggle[aria-pressed="true"] {
  border-color: var(--el-color-primary);
  color: var(--el-color-primary);
}
.page-follow-toggle:focus-visible,
.reasoning-return:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.reasoning-return {
  position: fixed;
  z-index: 20;
  bottom: max(20px, env(safe-area-inset-bottom));
  left: 20px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--app-bg);
  color: var(--el-color-primary);
  box-shadow: 0 4px 18px #0002;
  cursor: pointer;
}
.follow-jump {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 4px 0 4px 6px;
  border: 0;
  background: transparent;
  color: var(--el-color-primary);
  font-size: 10px;
  cursor: pointer;
}
.follow-jump .app-icon {
  transform: rotate(180deg);
}
.follow-jump:hover {
  text-decoration: underline;
}
.follow-jump:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}
.reasoning-progress {
  height: 2px;
  background: var(--el-border-color-light);
}
.reasoning-progress span {
  display: block;
  height: 100%;
  background: var(--el-color-primary);
}
.result-pending {
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 90px;
  padding: 20px 22px;
  color: var(--app-muted);
  font-size: 12px;
}
.pending-line {
  width: 18px;
  height: 2px;
  border-radius: 2px;
  background: var(--el-color-primary);
  animation: pending-slide 1.3s ease-in-out infinite;
}
.output-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  flex: 1;
  padding: 65px 22px;
  text-align: center;
}
.output-symbol {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  padding: 18px;
  border-radius: 20px;
}
.output-empty h3 {
  font-size: 15px;
  margin-top: 22px;
}
.output-empty p {
  font-size: 12px;
  color: var(--app-muted);
  line-height: 1.7;
}
footer {
  font-size: 11px;
  color: var(--app-muted);
  border-top: 1px solid var(--el-border-color-light);
  padding: 18px 20px;
}
.stream-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  margin-left: 8px;
}
@keyframes reasoning-pulse {
  0%,
  100% { opacity: 0.55; transform: scale(0.92); }
  50% { opacity: 1; transform: scale(1); }
}
@keyframes pending-slide {
  0%,
  100% { transform: translateX(0); opacity: 0.45; }
  50% { transform: translateX(8px); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .reasoning-icon.is-running,
  .reasoning-dot,
  .pending-line {
    animation: none;
  }
}
@media (max-width: 760px) {
  .reasoning-return { left: 12px; }
  .page-follow-toggle, .follow-jump { min-height: 44px; }
}
</style>
