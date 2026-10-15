import { onBeforeUnmount, ref, shallowRef } from 'vue';
import type { WorkflowRun, WorkflowStepRun } from '@/types';
import { streamEndpoint } from '@/utils/sse';

function updateStep(run: WorkflowRun, stepId: string, update: (step: WorkflowStepRun) => WorkflowStepRun) {
  return { ...run, steps: run.steps.map((step) => (step.stepId === stepId ? update(step) : step)) };
}

export function useWorkflowRunner() {
  const inputs = ref<Record<string, string>>({});
  const activeRun = shallowRef<WorkflowRun | null>(null);
  const running = ref(false);
  const error = ref('');
  let controller: AbortController | null = null;
  let generation = 0;

  function start(endpoint: string, payload: unknown, onFinished?: () => void) {
    controller?.abort();
    const current = ++generation;
    activeRun.value = null;
    error.value = '';
    running.value = true;
    controller = streamEndpoint(endpoint, payload, {
      onChunk: () => {},
      onEvent(event) {
        if (current !== generation) return;
        if (event.type === 'run-start' && event.run && typeof event.run === 'object') {
          activeRun.value = event.run as WorkflowRun;
        } else if (event.type === 'step-start' && typeof event.stepId === 'string' && activeRun.value) {
          activeRun.value = updateStep(activeRun.value, event.stepId, (step) => ({ ...step, status: 'running' }));
        } else if (event.type === 'step-delta' && typeof event.stepId === 'string' && typeof event.text === 'string' && activeRun.value) {
          activeRun.value = updateStep(activeRun.value, event.stepId, (step) => ({ ...step, output: step.output + event.text }));
        } else if (event.type === 'step-complete' && typeof event.stepId === 'string' && activeRun.value) {
          activeRun.value = updateStep(activeRun.value, event.stepId, (step) => ({
            ...step,
            status: 'success',
            output: typeof event.output === 'string' ? event.output : step.output,
            duration: typeof event.duration === 'number' ? event.duration : step.duration,
            tokenUsage: event.tokenUsage && typeof event.tokenUsage === 'object'
              ? event.tokenUsage as WorkflowStepRun['tokenUsage']
              : step.tokenUsage,
          }));
        } else if (event.type === 'step-error' && typeof event.stepId === 'string' && activeRun.value) {
          activeRun.value = updateStep(activeRun.value, event.stepId, (step) => ({
            ...step,
            status: 'error',
            errorMessage: typeof event.message === 'string' ? event.message : '步骤执行失败',
          }));
        } else if (event.type === 'run-complete' && activeRun.value) {
          const status = event.status;
          if (status === 'success' || status === 'error' || status === 'aborted') {
            activeRun.value = { ...activeRun.value, status };
          }
        }
      },
      onDone() {
        if (current !== generation) return;
        running.value = false;
        controller = null;
        onFinished?.();
      },
      onError(cause) {
        if (current !== generation) return;
        running.value = false;
        controller = null;
        error.value = cause.message;
        if (activeRun.value?.status === 'running') {
          activeRun.value = { ...activeRun.value, status: 'error' };
        }
      },
    });
  }

  function stop() {
    controller?.abort();
  }

  onBeforeUnmount(() => {
    generation += 1;
    controller?.abort();
  });

  return { inputs, activeRun, running, error, start, stop };
}
