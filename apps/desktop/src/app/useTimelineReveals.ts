import { onScopeDispose } from "vue";
import { useRouter } from "vue-router";
import { registerNetworkReveal } from "@/modules/network/public";
import { STREAM_CAPS } from "@/lib/stream-caps";
import { useConsoleStore } from "@/stores/console.store";
import { useDrawerStore } from "@/stores/drawer.store";
import { useLogcatStore } from "@/stores/logcat.store";
import { keptLookup } from "@/shared/timeline/keptLookup";
import { registerReveal } from "@/shared/timeline/revealRegistry";
import { requestRevealFocus, type RevealFocusKind } from "@/shared/timeline/revealFocus";
import type { DrawerView } from "@/types/drawer.types";

const count = new Intl.NumberFormat();

/**
 * Registers what "Go to" does for each kind of timeline marker: console messages and exceptions
 * open the drawer on Console, logcat lines on Logs, and the row is scrolled to and flashed; a
 * request is selected in Network. Mount once, in the main window.
 */
export function useTimelineReveals() {
  const router = useRouter();
  const drawer = useDrawerStore();
  const consoleStore = useConsoleStore();
  const logcat = useLogcatStore();

  const consoleKept = keptLookup(consoleStore.consoleSource.ring, (entry) => entry.id);
  const exceptionKept = keptLookup(consoleStore.exceptionSource.ring, (entry) => entry.id);
  const logcatKept = keptLookup(logcat.ring, (entry) => entry.id);

  function drawerReveal(view: DrawerView, focus: RevealFocusKind, isKept: (id: string) => boolean) {
    return (ref: { id: string }) => {
      if (!isKept(ref.id)) return false;
      drawer.open(view, view === "console" ? { mode: "stream" } : {});
      requestRevealFocus(focus, ref.id);
      return true;
    };
  }

  const disposers = [
    registerReveal("console", {
      keeps: `Console keeps the last ${count.format(STREAM_CAPS.console)} messages`,
      isKept: (ref) => consoleKept(ref.id),
      reveal: drawerReveal("console", "console", consoleKept),
    }),
    registerReveal("exception", {
      keeps: `Console keeps the last ${count.format(STREAM_CAPS.exceptions)} exceptions`,
      isKept: (ref) => exceptionKept(ref.id),
      reveal: drawerReveal("console", "exception", exceptionKept),
    }),
    registerReveal("logcat", {
      keeps: `Logs keeps the last ${count.format(STREAM_CAPS.logcat)} lines`,
      isKept: (ref) => logcatKept(ref.id),
      reveal: drawerReveal("logs", "logcat", logcatKept),
    }),
    registerNetworkReveal(router),
  ];

  onScopeDispose(() => {
    for (const dispose of disposers) dispose();
  });
}
