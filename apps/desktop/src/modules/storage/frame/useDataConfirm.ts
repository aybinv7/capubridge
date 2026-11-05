import { computed, shallowRef } from "vue";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";

interface PendingConfirm {
  request: ConfirmRequest;
  run: () => Promise<void> | void;
}

/**
 * One confirmation at a time for a Data tab: every delete, clear and replace asks first
 * through the shared Cladd `ConfirmDialog`, then runs.
 */
export function useDataConfirm() {
  const pending = shallowRef<PendingConfirm | null>(null);

  const open = computed({
    get: () => pending.value !== null,
    set: (value: boolean) => {
      if (!value) pending.value = null;
    },
  });
  const request = computed(() => pending.value?.request ?? null);

  function ask(next: ConfirmRequest, run: () => Promise<void> | void) {
    pending.value = { request: next, run };
  }

  async function confirm() {
    const current = pending.value;
    pending.value = null;
    if (current) await current.run();
  }

  return { open, request, ask, confirm };
}
