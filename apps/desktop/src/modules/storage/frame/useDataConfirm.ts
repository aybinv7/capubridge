import { computed, shallowRef } from "vue";
import type { ConfirmRequest } from "@/shared/components/presentation/confirm";

interface PendingConfirm {
  request: ConfirmRequest;
  settle: (confirmed: boolean) => void;
}

/**
 * One confirmation at a time for a Data tab: every delete, clear and replace asks first
 * through the shared Cladd `ConfirmDialog`, then runs. A new question answers an open one
 * with "no".
 */
export function useDataConfirm() {
  const pending = shallowRef<PendingConfirm | null>(null);

  function settle(confirmed: boolean) {
    const current = pending.value;
    pending.value = null;
    current?.settle(confirmed);
  }

  const open = computed({
    get: () => pending.value !== null,
    set: (value: boolean) => {
      if (!value) settle(false);
    },
  });
  const request = computed(() => pending.value?.request ?? null);

  /** Resolves `true` once the person confirms, `false` when they cancel or close it. */
  function askAsync(next: ConfirmRequest): Promise<boolean> {
    settle(false);
    return new Promise((resolve) => {
      pending.value = { request: next, settle: resolve };
    });
  }

  function ask(next: ConfirmRequest, run: () => Promise<void> | void) {
    void askAsync(next).then((confirmed) => (confirmed ? run() : undefined));
  }

  function confirm() {
    settle(true);
  }

  return { open, request, ask, askAsync, confirm };
}
