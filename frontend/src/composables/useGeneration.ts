import { onBeforeUnmount, shallowRef } from "vue";
import { streamEndpoint } from "@/utils/sse";

/** A generation belongs to one mounted view; cancelled callbacks must never mutate a later run. */
export function useGeneration() {
  const output = shallowRef("");
  const reasoning = shallowRef("");
  const running = shallowRef(false);
  const error = shallowRef("");
  const stopped = shallowRef(false);
  let controller: AbortController | null = null;
  let generation = 0;

  function stop() {
    generation += 1;
    const previous = controller;
    controller = null;
    if (running.value) stopped.value = true;
    running.value = false;
    previous?.abort();
  }
  function start(endpoint: string, payload: unknown, onDone?: () => void) {
    stop();
    const current = generation;
    output.value = "";
    reasoning.value = "";
    error.value = "";
    stopped.value = false;
    running.value = true;
    controller = streamEndpoint(endpoint, payload, {
      onChunk(text) {
        if (current === generation) output.value += text;
      },
      onReasoning(text) {
        if (current === generation) reasoning.value += text;
      },
      onDone() {
        if (current !== generation) return;
        running.value = false;
        controller = null;
        onDone?.();
      },
      onError(cause) {
        if (current !== generation) return;
        running.value = false;
        controller = null;
        error.value = cause.message;
      },
    });
  }
  onBeforeUnmount(stop);
  return { output, reasoning, running, error, stopped, start, stop };
}
