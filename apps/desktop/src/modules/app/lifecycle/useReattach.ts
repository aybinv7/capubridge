import { useTargetActivation } from "@/composables/useTargetActivation";
import { useConnectionStore } from "@/stores/connection.store";
import { useTargetsStore } from "@/stores/targets.store";
import type { CDPTarget } from "@/types/cdp.types";
import { packageOfTarget } from "../subject/packageName";

const ATTEMPTS = 8;
const ATTEMPT_DELAY_MS = 1000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** The page the app had before it was started again. */
export interface PreviousPage {
  id: string;
  url: string | null;
}

/**
 * The app's page to attach to once it is back: a new page (the old one died with its process)
 * at the same address if there is one, else the app's first page.
 */
export function pickReturningPage(
  targets: readonly CDPTarget[],
  serial: string,
  packageName: string,
  previous: PreviousPage | null,
): CDPTarget | null {
  const pages = targets.filter(
    (target) =>
      target.id !== previous?.id &&
      target.source === "adb" &&
      target.deviceSerial === serial &&
      target.type === "page" &&
      packageOfTarget(target.packageName) === packageName,
  );
  return pages.find((target) => target.url === previous?.url) ?? pages[0] ?? null;
}

/**
 * Attaches DevTools to the app again after it was started anew. A new process opens a new
 * DevTools socket, so the old link is dead: the phone is asked for its WebViews about once a
 * second until the app's page is back, for up to eight seconds.
 */
export function useReattach() {
  const targetsStore = useTargetsStore();
  const connections = useConnectionStore();
  const { activateTarget } = useTargetActivation();

  function attachedTo(target: CDPTarget): boolean {
    return (
      targetsStore.selectedTarget?.id === target.id &&
      connections.connections.get(target.id)?.status === "connected"
    );
  }

  /** Whether the selected page still has a live DevTools link. */
  function linked(): boolean {
    const selected = targetsStore.selectedTarget;
    return selected ? connections.connections.get(selected.id)?.status === "connected" : false;
  }

  async function reattach(
    serial: string,
    packageName: string,
    previous: PreviousPage | null,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      await wait(ATTEMPT_DELAY_MS);
      await targetsStore.fetchTargetsForSource({ type: "adb", serial });
      const page = pickReturningPage(targetsStore.targets, serial, packageName, previous);
      if (!page) continue;
      if (!attachedTo(page)) await activateTarget(page);
      return true;
    }
    return false;
  }

  return { reattach, linked };
}
