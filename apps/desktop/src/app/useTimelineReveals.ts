import { onScopeDispose } from "vue";
import { useRouter } from "vue-router";
import { registerNetworkReveal } from "@/modules/network/public";
import { STREAM_CAPS } from "@/lib/stream-caps";
import { useConsoleStore } from "@/stores/console.store";
import { useDockStore } from "@/stores/dock.store";
import { useLogcatStore } from "@/stores/logcat.store";
import { keptLookup } from "@/shared/timeline/keptLookup";
import { registerReveal } from "@/shared/timeline/revealRegistry";
import { requestRevealFocus, type RevealFocusKind } from "@/shared/timeline/revealFocus";
import type { DockTab } from "@/types/dock.types";

const count = new Intl.NumberFormat();

/**
 * Registers what "Go to" does for each kind of timeline marker: the console, exception and
 * logcat rows open their dock tab and scroll to the row and flash it; a request is selected in
 * Network. Mount once, in the main window.
 */
export function useTimelineReveals() {
  const router = useRouter();
  const dock = useDockStore();
  const consoleStore = useConsoleStore();
  const logcat = useLogcatStore();

  const consoleKept = keptLookup(consoleStore.consoleSource.ring, (entry) => entry.id);
  const exceptionKept = keptLookup(consoleStore.exceptionSource.ring, (entry) => entry.id);
  const logcatKept = keptLookup(logcat.ring, (entry) => entry.id);

  function dockReveal(tab: DockTab, focus: RevealFocusKind, isKept: (id: string) => boolean) {
    return (ref: { id: string }) => {
      if (!isKept(ref.id)) return false;
      dock.openDock(tab);
      requestRevealFocus(focus, ref.id);
      return true;
    };
  }

  const disposers = [
    registerReveal("console", {
      keeps: `Console keeps the last ${count.format(STREAM_CAPS.console)} messages`,
      isKept: (ref) => consoleKept(ref.id),
      reveal: dockReveal("console", "console", consoleKept),
    }),
    registerReveal("exception", {
      keeps: `Exceptions keeps the last ${count.format(STREAM_CAPS.exceptions)}`,
      isKept: (ref) => exceptionKept(ref.id),
      reveal: dockReveal("exceptions", "exception", exceptionKept),
    }),
    registerReveal("logcat", {
      keeps: `Logcat keeps the last ${count.format(STREAM_CAPS.logcat)} lines`,
      isKept: (ref) => logcatKept(ref.id),
      reveal: dockReveal("logcat", "logcat", logcatKept),
    }),
    registerNetworkReveal(router),
  ];

  onScopeDispose(() => {
    for (const dispose of disposers) dispose();
  });
}
