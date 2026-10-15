import { computed, ref, shallowRef } from "vue";
import type { ComputedRef } from "vue";
import type { Flow } from "@/types/automation.types";
import type { RunView } from "./runSource";
import type { ActiveRun } from "./runObserver";
import {
  activeRunOf,
  applyRunEvent,
  describeOrigin,
  foreignActiveRun,
  runViewOf,
  workbenchStartReason,
} from "./runObserver";
import { getRunRegistry } from "./runRegistry";

/**
 * Observed runs live at module scope, not in a component. A run started over
 * MCP exists whether or not the workbench is mounted, and navigating away
 * and back must re-attach to it rather than orphan it.
 */
const runs = shallowRef(new Map<string, ActiveRun>());
const localRunId = ref<string | null>(null);
let unsubscribe: (() => void) | null = null;

function attach(): void {
  if (unsubscribe !== null) {
    return;
  }
  unsubscribe = getRunRegistry().subscribe((event) => {
    runs.value = applyRunEvent(runs.value, event);
  });
}

/**
 * The run the workbench should be showing: the one this UI started while it
 * is still live, otherwise any other run currently holding the device,
 * otherwise the most recently started run so a just-finished run stays on
 * screen instead of vanishing.
 */
function selectRun(all: ReadonlyMap<string, ActiveRun>, local: string | null): ActiveRun | null {
  const own = local === null ? null : activeRunOf(all, local);
  if (own !== null && own.status === "running") {
    return own;
  }
  const foreign = foreignActiveRun(all, local);
  if (foreign !== null) {
    return foreign;
  }
  if (own !== null) {
    return own;
  }
  let latest: ActiveRun | null = null;
  for (const run of all.values()) {
    if (latest === null || run.startedAt > latest.startedAt) {
      latest = run;
    }
  }
  return latest;
}

export function useWorkbenchRun() {
  attach();

  const activeRun = computed(() => selectRun(runs.value, localRunId.value));

  const liveView: ComputedRef<RunView | null> = computed(() => {
    const run = activeRun.value;
    return run === null ? null : runViewOf(run);
  });

  const isForeign = computed(() => {
    const run = activeRun.value;
    return run !== null && run.runId !== localRunId.value;
  });

  const originLabel = computed(() => {
    const run = activeRun.value;
    return run === null ? null : describeOrigin(run.origin);
  });

  const isRunning = computed(() => activeRun.value?.status === "running");

  function blockedReason(input: {
    flow: Flow | null;
    deviceSerial: string | null;
    runnable: boolean;
    invalidReason: string | null;
  }): string | null {
    return workbenchStartReason({ ...input, runs: runs.value, localRunId: localRunId.value });
  }

  function start(flow: Flow, deviceSerial: string): string {
    const runId = getRunRegistry().startFlow(flow.id, deviceSerial);
    localRunId.value = runId;
    return runId;
  }

  /**
   * Cancels whichever run is on screen, including one this UI did not start.
   * Visibility of a foreign run is not permission to control it: the
   * registry still applies its own authorization on the way through.
   */
  async function cancel(): Promise<void> {
    const run = activeRun.value;
    if (run === null || run.status !== "running") {
      return;
    }
    try {
      await getRunRegistry().cancelRun(run.runId);
    } catch {
      return;
    }
  }

  return {
    runs,
    activeRun,
    liveView,
    isForeign,
    isRunning,
    originLabel,
    blockedReason,
    start,
    cancel,
  };
}
