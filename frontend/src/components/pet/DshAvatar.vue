<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import type { PetAnimation } from "@/utils/dsh-pet";

const props = withDefaults(defineProps<{
  animation?: PetAnimation;
  animationId?: number;
  active?: boolean;
  static?: boolean;
}>(), { animation: "idle", animationId: 0, active: true, static: false });
const emit = defineEmits<{ finished: [] }>();
const video = shallowRef<HTMLVideoElement | null>(null);
const ready = shallowRef(false);
const failed = shallowRef(false);
const pageVisible = shallowRef(!document.hidden);
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const reducedMotion = shallowRef(motionQuery.matches);
// WebKit may decode VP9 without its alpha channel. Use the transparent poster there.
const webkit = /AppleWebKit/.test(navigator.userAgent) &&
  (!/Chrome|Chromium|Edg\//.test(navigator.userAgent) || /iPad|iPhone|iPod/.test(navigator.userAgent));
const supported = !webkit && !!document.createElement("video").canPlayType('video/webm; codecs="vp9"');
const assetRoot = `${import.meta.env.BASE_URL}pets/dsh-pet/`;
const poster = computed(() => `${assetRoot}${props.animation === "sleep" ? "sleep" : "idle"}.png`);
const animated = computed(() => !props.static && supported && !reducedMotion.value && !failed.value);
const looping = computed(() => ["idle", "sleep", "drag"].includes(props.animation));

function syncPlayback() {
  const element = video.value;
  if (!element) return;
  if (!props.active || !pageVisible.value) {
    element.pause();
    return;
  }
  void element.play().catch((error: unknown) => {
    // Source switches and hiding can cancel an outstanding play request normally.
    if (video.value === element && !(error instanceof DOMException && error.name === "AbortError")) {
      failed.value = true;
    }
  });
}
function onPlaying(event: Event) {
  if (event.currentTarget === video.value) ready.value = true;
}
function onEnded(event: Event) {
  if (event.currentTarget === video.value && !looping.value) emit("finished");
}
function onVisibility() { pageVisible.value = !document.hidden; }
function onMotion(event: MediaQueryListEvent) { reducedMotion.value = event.matches; }
watch(() => [props.animation, props.animationId], () => { ready.value = false; }, { flush: "sync" });
watch([video, () => props.active, pageVisible], syncPlayback, { flush: "post" });
onMounted(() => {
  document.addEventListener("visibilitychange", onVisibility);
  motionQuery.addEventListener("change", onMotion);
});
onBeforeUnmount(() => {
  video.value?.pause();
  document.removeEventListener("visibilitychange", onVisibility);
  motionQuery.removeEventListener("change", onMotion);
});
</script>

<template>
  <span class="dsh-avatar" aria-hidden="true">
    <img :src="poster" alt="" draggable="false" :class="{ hidden: animated && ready }" />
    <video
      v-if="animated"
      :key="`${animation}-${animationId}`"
      ref="video"
      :src="`${assetRoot}${animation}.webm`"
      :loop="looping"
      :class="{ hidden: !ready }"
      muted
      playsinline
      preload="auto"
      disablepictureinpicture
      @playing="onPlaying"
      @ended="onEnded"
      @error="failed = true"
    />
  </span>
</template>

<style scoped>
.dsh-avatar {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
}
.dsh-avatar img,
.dsh-avatar video {
  position: absolute;
  top: 0;
  left: 50%;
  height: 100%;
  width: auto;
  max-width: none;
  aspect-ratio: 16 / 9;
  transform: translateX(-50%);
}
.hidden { visibility: hidden; }
</style>
