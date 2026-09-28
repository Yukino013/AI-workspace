<script setup lang="ts">
import { computed, nextTick, shallowRef, useId, watch } from "vue";
import { useRouter } from "vue-router";
import AppIcon from "@/components/common/AppIcon.vue";
import { useWhalePet } from "@/composables/useWhalePet";
import WhaleAvatar from "./WhaleAvatar.vue";

const props = defineProps<{ suspended?: boolean }>();
const emit = defineEmits<{ hide: [] }>();
const router = useRouter();
const petButton = shallowRef<HTMLButtonElement>();
const id = useId();
const {
  visible,
  asleep,
  position,
  viewport,
  size,
  dragging,
  delighted,
  speaking,
  message,
  toggle,
  hide,
  interact,
  splash,
  rest,
  endGesture,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
  onKeydown,
} = useWhalePet();

// Fixed positioning keeps the speech bubble inside the viewport even at the drag boundaries.
const bubbleStyle = computed(() => {
  const width = Math.min(256, viewport.value.width - 24);
  const above =
    position.value.y > (viewport.value.height - size.value.height) / 2;
  const gap = 8;
  return {
    width: `${width}px`,
    left: `${Math.max(12, Math.min(viewport.value.width - width - 12, position.value.x + size.value.width / 2 - width / 2))}px`,
    ...(above
      ? {
          bottom: `${viewport.value.height - position.value.y + gap}px`,
          maxHeight: `${Math.max(60, position.value.y - gap - 12)}px`,
        }
      : {
          top: `${position.value.y + size.value.height + gap}px`,
          maxHeight: `${Math.max(60, viewport.value.height - position.value.y - size.value.height - gap - 12)}px`,
        }),
  };
});
watch(
  () => props.suspended,
  (suspended) => {
    if (suspended) {
      endGesture();
      speaking.value = false;
    }
  },
);
function dismiss() {
  hide();
  emit("hide");
}
function closeBubble() {
  speaking.value = false;
  petButton.value?.focus();
}
function escape() {
  if (speaking.value) closeBubble();
  else dismiss();
}
async function togglePet() {
  toggle();
  if (visible.value) {
    await nextTick();
    petButton.value?.focus();
  }
}
async function chat() {
  closeBubble();
  await router.push("/chat");
}
defineExpose({ toggle: togglePet, visible });
</script>

<template>
  <section
    v-show="visible && !suspended"
    class="whale-pet"
    :class="{ 'is-dragging': dragging }"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${size.width}px`,
      height: `${size.height}px`,
    }"
    aria-label="DeepSeek 大肥鲸桌宠"
    @keydown.esc.stop.prevent="escape"
  >
    <button
      class="pet-hide"
      aria-label="收起鲸鱼桌宠"
      title="收起桌宠，可从顶栏唤回"
      @click="dismiss"
    >
      <AppIcon name="close" :size="13" />
    </button>
    <button
      ref="petButton"
      class="pet-body"
      aria-label="摸摸 DeepSeek 大肥鲸"
      :aria-describedby="`${id}-instructions`"
      :aria-expanded="speaking"
      :aria-controls="`${id}-bubble`"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerEnd"
      @pointercancel="onPointerEnd"
      @lostpointercapture="onPointerEnd"
      @click="interact"
      @keydown="onKeydown"
    >
      <WhaleAvatar :asleep="asleep" :delighted="delighted" />
    </button>
    <span class="pet-name"
      ><span class="pet-status" :class="{ 'is-asleep': asleep }" />DeepSeek<span
        class="pet-name-divider"
        >/</span
      >大肥鲸</span
    >
    <span :id="`${id}-instructions`" class="pet-sr-only"
      >点击互动，拖动移动。聚焦鲸鱼后用方向键移动，Shift 加方向键加速，Escape
      关闭气泡或收起。</span
    >
    <div
      v-if="speaking"
      :id="`${id}-bubble`"
      class="pet-bubble"
      :style="bubbleStyle"
    >
      <div class="bubble-header">
        <span class="bubble-eyebrow">YOUR LITTLE COMPANION</span
        ><button
          class="bubble-close"
          aria-label="关闭鲸鱼气泡"
          @click="closeBubble"
        >
          <AppIcon name="close" :size="14" />
        </button>
      </div>
      <strong class="bubble-title">一小只鲸，陪你造浪。</strong>
      <p role="status" aria-live="polite">{{ message }}</p>
      <div class="bubble-actions">
        <button class="splash-action" @click="splash">
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 2C7 5 3.5 7.8 3.5 10.5a4.5 4.5 0 009 0C12.5 7.8 9 5 8 2Z"
              stroke="currentColor"
              stroke-width="1.3"
            />
            <path
              d="M6 10.5c0 1 .5 1.5 1.5 1.5"
              stroke="currentColor"
              stroke-linecap="round"
            /></svg
          >喷水
        </button>
        <button @click="rest">
          <AppIcon :name="asleep ? 'sun' : 'moon'" :size="14" />{{
            asleep ? "唤醒" : "休息"
          }}
        </button>
        <button @click="chat">
          去聊聊<AppIcon name="arrow-up-right" :size="14" />
        </button>
      </div>
      <span class="bubble-hint">拖动我，找个喜欢的位置</span>
    </div>
  </section>
</template>

<style scoped>
.whale-pet {
  position: fixed;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  user-select: none;
}
.pet-body {
  display: block;
  width: 100%;
  flex: 1;
  min-height: 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: grab;
  touch-action: none;
  border-radius: 45%;
  -webkit-tap-highlight-color: transparent;
}
.is-dragging .pet-body {
  cursor: grabbing;
}
.is-dragging :deep(.whale-art *) {
  animation-play-state: paused;
}
.pet-name {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 9px;
  border: 1px solid var(--app-line);
  border-radius: 20px;
  background: var(--app-bg);
  color: var(--app-muted);
  font-size: 9px;
  line-height: 14px;
  white-space: nowrap;
  box-shadow: 0 3px 12px #21366c08;
  pointer-events: none;
}
.pet-name-divider {
  opacity: 0.4;
}
.pet-status {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #5483f6;
}
.pet-status.is-asleep {
  background: var(--app-muted);
}
.pet-hide {
  position: absolute;
  z-index: 1;
  top: 18px;
  right: 0;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 1px solid var(--app-line);
  background: var(--app-bg);
  color: var(--app-muted);
  opacity: 0;
  transition: opacity 0.15s;
  cursor: pointer;
}
.whale-pet:hover .pet-hide,
.whale-pet:focus-within .pet-hide {
  opacity: 1;
}
.pet-bubble {
  position: fixed;
  padding: 16px;
  border: 1px solid var(--app-line);
  border-radius: 18px;
  background: var(--app-bg);
  box-shadow:
    0 12px 44px #152b5b14,
    0 2px 8px #152b5b08;
  color: var(--app-text);
  overflow-y: auto;
  user-select: text;
}
.bubble-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.bubble-eyebrow {
  font-size: 8px;
  letter-spacing: 1.2px;
  color: var(--app-muted);
}
.bubble-close {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: -8px -8px -4px 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--app-muted);
  cursor: pointer;
}
.bubble-title {
  font-size: 14px;
  letter-spacing: -0.2px;
  font-weight: 600;
}
.pet-bubble p {
  font-size: 12px;
  line-height: 1.8;
  margin: 10px 0 14px;
  color: var(--app-muted);
}
.bubble-actions {
  display: flex;
  gap: 6px;
}
.bubble-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  min-height: 32px;
  padding: 0 6px;
  border: 1px solid var(--app-line);
  border-radius: 9px;
  background: var(--app-surface);
  color: var(--app-text);
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s;
}
.bubble-actions .splash-action {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary-light-8);
}
.bubble-actions button:hover,
.bubble-close:hover {
  background: var(--el-color-primary-light-8);
}
.bubble-hint {
  display: block;
  text-align: center;
  margin-top: 12px;
  font-size: 9px;
  color: var(--app-muted);
}
.whale-pet button:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 3px;
}
.pet-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (max-width: 760px) {
  .pet-hide {
    opacity: 1;
    top: 3px;
  }
  .pet-name {
    font-size: 8px;
    padding: 2px 6px;
    gap: 4px;
  }
  .bubble-actions button {
    min-height: 38px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .whale-pet * {
    transition: none !important;
  }
}
</style>
