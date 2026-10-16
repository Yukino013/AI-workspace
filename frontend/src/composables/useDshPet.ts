import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";
import {
  PET_STORAGE_KEY,
  LEGACY_PET_STORAGE_KEY,
  type PetAction,
  clampPetPosition,
  petSize,
  readPetPreferences,
  relativePetPosition,
  restorePetPosition,
  type PetPoint,
} from "@/utils/dsh-pet";

/** Local-only companion: no AI requests, global pointer listeners, or background timers. */
export function useDshPet() {
  const viewport = shallowRef({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PET_STORAGE_KEY) ?? localStorage.getItem(LEGACY_PET_STORAGE_KEY);
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
  const action = shallowRef<PetAction | null>(null);
  const animationId = shallowRef(0);
  const speaking = shallowRef(false);
  const message = shallowRef(
    "Ciallo～我是你的新搭子，今天也一起写点有趣的东西吧。",
  );
  const phrases = [
    "摸到了！今天的快乐，是双倍的。",
    "收到摸摸！给你一个元气满满的回应。",
    "代码可以慢慢写，记得喝口水呀。",
    "你负责奇思妙想，我负责加油打气。",
    "今天也要给自己一点点惊喜。",
  ];
  let phrase = 0;
  let gesture: {
    id: number;
    startX: number;
    startY: number;
    origin: PetPoint;
    moved: boolean;
  } | null = null;
  let suppressClick = false;
  let pointerTarget: HTMLElement | null = null;
  let actionTimeout: ReturnType<typeof setTimeout> | undefined;

  function persist() {
    try {
      localStorage.setItem(
        PET_STORAGE_KEY,
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
  function animate(next: PetAction = "wave") {
    if (actionTimeout) clearTimeout(actionTimeout);
    action.value = next;
    animationId.value += 1;
    actionTimeout = setTimeout(finishAnimation, 3600);
  }
  function finishAnimation() {
    if (actionTimeout) clearTimeout(actionTimeout);
    actionTimeout = undefined;
    action.value = null;
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
    animate(phrase % 2 ? "happy" : "wave");
  }
  function bubbles() {
    asleep.value = false;
    message.value = "啵啵～送你一串灵感泡泡！";
    speaking.value = true;
    animate("bubbles");
    persist();
  }
  function rest() {
    asleep.value = !asleep.value;
    finishAnimation();
    message.value = asleep.value
      ? "我先打个盹，不打扰你专心创造。"
      : "睡饱啦！继续陪你写代码。";
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
    finishAnimation();
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
    finishAnimation();
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
    finishAnimation();
    endGesture();
  });
  return {
    visible,
    asleep,
    position,
    viewport,
    size,
    dragging,
    action,
    animationId,
    finishAnimation,
    speaking,
    message,
    toggle,
    hide,
    interact,
    bubbles,
    rest,
    endGesture,
    onPointerDown,
    onPointerMove,
    onPointerEnd,
    onKeydown,
  };
}
