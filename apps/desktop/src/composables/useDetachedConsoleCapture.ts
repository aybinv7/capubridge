import { onScopeDispose, watch } from "vue";
import { emitEvent, listenEvent } from "@/runtime/ipc/client";
import { useConsoleStore } from "@/stores/console.store";
import { useTargetsStore } from "@/stores/targets.store";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Console capture for a popped-out Console, REPL or Exceptions window. It follows the target the
 * main window has selected (relayed by `useDockTargetRelay`) and holds its own console lease, so
 * the pop-out connects instead of waiting forever for a target.
 */
export function useDetachedConsoleCapture() {
  const consoleStore = useConsoleStore();
  const targetsStore = useTargetsStore();
  let stopListening: (() => void) | null = null;
  let disposed = false;

  function report(prefix: string, error: unknown) {
    consoleStore.error = `${prefix}: ${describe(error)}`;
  }

  listenEvent("capubridge:dock-target", ({ target }) => {
    targetsStore.selectedTarget = target;
  })
    .then((unlisten) => {
      if (disposed) {
        unlisten();
        return;
      }
      stopListening = unlisten;
      return emitEvent("capubridge:dock-target-request", { requestedAt: Date.now() });
    })
    .catch((error: unknown) => report("Could not get the target from the main window", error));

  consoleStore.acquireLease().catch((error: unknown) => report("Console capture failed", error));

  watch(
    () => consoleStore.activeTarget,
    (target) => {
      consoleStore
        .syncLease(target ?? null)
        .catch((error: unknown) => report("Console capture failed", error));
    },
  );

  onScopeDispose(() => {
    disposed = true;
    stopListening?.();
    stopListening = null;
    consoleStore
      .releaseLease()
      .catch((error: unknown) => report("Console capture did not stop cleanly", error));
  });
}
