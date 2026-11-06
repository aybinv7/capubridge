import { onScopeDispose, toRaw, watch } from "vue";
import { emitEvent, listenEvent } from "@/runtime/ipc/client";
import { useTargetsStore } from "@/stores/targets.store";
import type { CDPTarget } from "@/types/cdp.types";

/**
 * Main window side of drawer views in their own window: tells them which target is selected,
 * on every change and whenever one asks. Those windows have no shell and no selection of their own.
 */
export function useDrawerTargetRelay(onError: (message: string) => void) {
  const targetsStore = useTargetsStore();
  let stopListening: (() => void) | null = null;
  let disposed = false;

  function send(target: CDPTarget | null) {
    const plain = target ? { ...toRaw(target) } : null;
    emitEvent("capubridge:dock-target", { target: plain }).catch((error: unknown) => {
      onError(`Could not reach popped-out console windows: ${String(error)}`);
    });
  }

  watch(
    () => targetsStore.selectedTarget,
    (target) => send(target),
  );

  listenEvent("capubridge:dock-target-request", () => send(targetsStore.selectedTarget))
    .then((unlisten) => {
      if (disposed) {
        unlisten();
        return;
      }
      stopListening = unlisten;
    })
    .catch((error: unknown) => {
      onError(`Popped-out console windows cannot ask for the target: ${String(error)}`);
    });

  onScopeDispose(() => {
    disposed = true;
    stopListening?.();
    stopListening = null;
  });
}
