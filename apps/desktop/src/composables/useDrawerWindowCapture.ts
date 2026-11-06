import { onScopeDispose, watch } from "vue";
import { useLogcatCapture } from "@/composables/useLogcatCapture";
import { emitEvent, listenEvent } from "@/runtime/ipc/client";
import { useConsoleStore } from "@/stores/console.store";
import { useLogcatStore } from "@/stores/logcat.store";
import { useSessionStore } from "@/stores/session.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { DrawerView } from "@/types/drawer.types";

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Capture for the drawer's views in a window of their own. The window follows the main window's
 * selected target (relayed by `useDrawerTargetRelay`) and reads the device registry, so its
 * gates and `package:mine` see what the main window sees. Logs joins the device's one logcat
 * run; Console holds its own console lease on the same target.
 */
export function useDrawerWindowCapture(views: readonly DrawerView[]) {
  const hasLogs = views.includes("logs");
  const hasConsole = views.includes("console");
  const sessionStore = useSessionStore();
  const targetsStore = useTargetsStore();
  const consoleStore = useConsoleStore();
  const logcatStore = useLogcatStore();
  let stopListening: (() => void) | null = null;
  let disposed = false;

  function report(prefix: string, error: unknown, only?: DrawerView) {
    const message = `${prefix}: ${describe(error)}`;
    if (hasLogs && only !== "console") logcatStore.error = message;
    if (hasConsole && only !== "logs") consoleStore.error = message;
  }

  sessionStore
    .initialize()
    .catch((error: unknown) => report("Could not read the device list", error));

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

  if (hasLogs) useLogcatCapture();
  if (hasConsole) {
    consoleStore
      .acquireLease()
      .catch((error: unknown) => report("Console capture failed", error, "console"));
    watch(
      () => consoleStore.activeTarget,
      (target) => {
        consoleStore
          .syncLease(target ?? null)
          .catch((error: unknown) => report("Console capture failed", error, "console"));
      },
    );
  }

  onScopeDispose(() => {
    disposed = true;
    stopListening?.();
    stopListening = null;
    if (hasConsole) {
      consoleStore
        .releaseLease()
        .catch((error: unknown) =>
          report("Console capture did not stop cleanly", error, "console"),
        );
    }
  });
}
