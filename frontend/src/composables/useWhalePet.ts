import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";
import {
  WHALE_STORAGE_KEY,
  clampPetPosition,
  petSize,
  readPetPreferences,
  relativePetPosition,
  restorePetPosition,
  type PetPoint,
} from "@/utils/whale-pet";

/** Local-only companion: no AI requests, global pointer listeners, or background timers. */
export function useWhalePet() {
  const viewport = shallowRef({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(WHALE_STORAGE_KEY);
  } catch {
    /* Private mode: keep session state. */
  }
  const saved = readPetPreferences(raw, viewport.value.width <= 760);
  const visible = shallowRef(saved.visible);
  const asleep = shallowRef(saved.asleep);
  const position = shallowRef(
    restorePetPosition(saved.position, viewport.value),
  );
  const size = computed(() => petSize(viewport.value.width));
  const dragging = shallowRef(false);
  const delighted = shallowRef(false);
  const speaking = shallowRef(false);
  const message = shallowRef(
    "我是 DeepSeek 大肥鲸。灵感的海很大，我陪你慢慢游。",
  );
  const phrases = [
    "摸到了！今天的快乐，是双倍的。",
    "别看我圆，装的可都是好点子。",
    "代码可以慢慢写，记得喝口水呀。",
    "你负责奇思妙想，我负责扑通扑通。",
    "今天也要给自己一点点「鲸」喜。",
  ];
  let phrase = 0;
  let animationTimer: ReturnType<typeof setTimeout> | undefined;
  let gesture: {
    id: number;
    startX: number;
    startY: number;
    origin: PetPoint;
    moved: boolean;
  } | null = null;
  let suppressClick = false;
  let pointerTarget: HTMLElement | null = null;

  function persist() {
    try {
      localStorage.setItem(
        WHALE_STORAGE_KEY,
        JSON.stringify({
          visible: visible.value,
          asleep: asleep.value,
          position: relativePetPosition(position.value, viewport.value),
        }),
      );
    } catch {
      /* Optional preference persistence must never block the workbench. */
    }
  }
  function animate() {
    clearTimeout(animationTimer);
    delighted.value = true;
    animationTimer = setTimeout(() => {
      delighted.value = false;
    }, 1400);
  }
  function interact() {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    speaking.value = true;
    if (asleep.value) {
      message.value = "呼噜…正在梦里收集灵感。点「唤醒」叫我吧。";
      return;
    }
    message.value = phrases[phrase++ % phrases.length]!;
    animate();
  }
  function splash() {
    asleep.value = false;
    message.value = "噗——送你一朵灵感小水花！";
    speaking.value = true;
    animate();
    persist();
  }
  function rest() {
    asleep.value = !asleep.value;
    clearTimeout(animationTimer);
    delighted.value = false;
    message.value = asleep.value
      ? "我先打个盹，不打扰你专心创造。"
      : "睡饱啦！新的灵感，正在靠岸。";
    if (!asleep.value) animate();
    persist();
  }
  function endGesture() {
    const id = gesture?.id;
    gesture = null;
    dragging.value = false;
    if (id !== undefined && pointerTarget?.hasPointerCapture(id))
      pointerTarget.releasePointerCapture(id);
    pointerTarget = null;
  }
  function hide() {
    endGesture();
    visible.value = false;
    speaking.value = false;
    clearTimeout(animationTimer);
    delighted.value = false;
    persist();
  }
  function toggle() {
    if (visible.value) hide();
    else {
      visible.value = true;
      position.value = clampPetPosition(position.value, viewport.value);
      persist();
    }
  }
  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return;
    suppressClick = false;
    gesture = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { ...position.value },
      moved: false,
    };
    pointerTarget = event.currentTarget as HTMLElement;
    pointerTarget.setPointerCapture(event.pointerId);
  }
  function onPointerMove(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.startX,
      dy = event.clientY - gesture.startY;
    if (!gesture.moved && Math.hypot(dx, dy) < 6) return;
    gesture.moved = true;
    dragging.value = true;
    speaking.value = false;
    position.value = clampPetPosition(
      { x: gesture.origin.x + dx, y: gesture.origin.y + dy },
      viewport.value,
    );
  }
  function onPointerEnd(event: PointerEvent) {
    if (!gesture || event.pointerId !== gesture.id) return;
    suppressClick =
      gesture.moved ||
      event.type === "pointercancel" ||
      event.type === "lostpointercapture";
    endGesture();
    persist();
  }
  function onKeydown(event: KeyboardEvent) {
    // Keyboard activation must not inherit suppression from the last drag.
    if (event.key === "Enter" || event.key === " ") suppressClick = false;
    const directions: Record<string, PetPoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 12;
    speaking.value = false;
    position.value = clampPetPosition(
      {
        x: position.value.x + direction.x * step,
        y: position.value.y + direction.y * step,
      },
      viewport.value,
    );
    persist();
  }
  function resize() {
    const relative = relativePetPosition(position.value, viewport.value);
    endGesture();
    viewport.value = { width: window.innerWidth, height: window.innerHeight };
    position.value = restorePetPosition(relative, viewport.value);
  }
  onMounted(() => window.addEventListener("resize", resize));
  onBeforeUnmount(() => {
    window.removeEventListener("resize", resize);
    clearTimeout(animationTimer);
    endGesture();
  });
  return {
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
  };
}
