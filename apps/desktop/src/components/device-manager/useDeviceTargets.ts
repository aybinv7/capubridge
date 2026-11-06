import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { useConnectionStore } from "@/stores/connection.store";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useTargetActivation } from "@/composables/useTargetActivation";
import { useCDP } from "@/composables/useCDP";
import { useLocalPageHistoryStore } from "@/stores/localPageHistory.store";
import { normalizeInspectableUrl } from "@/lib/inspect-url";
import { isNativeAppTarget } from "@/lib/app-target";
import type { CDPTarget } from "@/types/cdp.types";
import type { DeviceManagerState } from "./useDeviceManager";
import { groupTargetsByApp } from "./targetGroups";
import { readLocalPageIdentity } from "./readLocalPageIdentity";

/** Targets on the viewed device and on This PC, and every action on them. */
export function useDeviceTargets(manager: DeviceManagerState, close: () => void) {
  const router = useRouter();
  const targetsStore = useTargetsStore();
  const connectionStore = useConnectionStore();
  const localWebviewStore = useLocalWebviewStore();
  const { activateTarget } = useTargetActivation();
  const { connectToTarget } = useCDP();
  const pageHistory = useLocalPageHistoryStore();

  const scanning = ref(false);
  const creatingLocal = ref(false);

  const selectedTargetId = computed(() => targetsStore.selectedTarget?.id ?? null);
  const viewedTargets = computed(() =>
    targetsStore.targets.filter(
      (target) => target.source === "adb" && target.deviceSerial === manager.viewedSerial.value,
    ),
  );
  const deviceTargets = computed(() =>
    viewedTargets.value.filter((target) => !isNativeAppTarget(target)),
  );
  const appTargets = computed(() => viewedTargets.value.filter(isNativeAppTarget));
  const groups = computed(() => groupTargetsByApp(deviceTargets.value, selectedTargetId.value));
  const localTargets = computed(() =>
    targetsStore.targets.filter((target) => target.source === "local"),
  );
  const isScanning = computed(() => scanning.value || targetsStore.fetchingSources.size > 0);
  const isScanningApps = computed(() =>
    targetsStore.scanningApps.has(manager.viewedSerial.value ?? ""),
  );

  async function refreshTargets() {
    const current = manager.viewedSerial.value;
    if (scanning.value || !current) return;
    scanning.value = true;
    try {
      await manager.withPollingPaused(() =>
        targetsStore.fetchTargetsForSource({ type: "adb", serial: current }),
      );
    } catch (error) {
      toast.error("Could not scan for targets", { description: String(error) });
    } finally {
      scanning.value = false;
    }
  }

  /**
   * Every time the manager opens on a device, and whenever another device is viewed, its
   * WebViews are scanned again: the list must never show yesterday's WebViews, or only the
   * debuggable apps, while a WebView is open on the phone.
   */
  watch(
    () => {
      const device = manager.viewedDevice.value;
      const ready = device && device.status === "online" && !device.isStale;
      return [ready ? device.serial : null, manager.openings.value] as const;
    },
    ([serial]) => {
      if (serial) void refreshTargets();
    },
    { immediate: true },
  );

  async function selectTarget(target: CDPTarget) {
    try {
      await manager.withPollingPaused(() => activateTarget(target));
      close();
    } catch (error) {
      toast.error("Could not attach to the target", { description: String(error) });
    }
  }

  async function inspectTarget(target: CDPTarget) {
    try {
      await activateTarget(target);
      close();
      if (target.source === "local") {
        await localWebviewStore.openDevtools(target);
        return;
      }
      await router.push("/inspect/elements");
    } catch (error) {
      toast.error("Could not inspect the target", { description: String(error) });
    }
  }

  async function removeLocalTarget(target: CDPTarget) {
    try {
      await localWebviewStore.closeTarget(target);
      targetsStore.removeTarget(target.id);
      toast.info("Local page removed");
    } catch (error) {
      toast.error("Could not remove the local page", { description: String(error) });
    }
  }

  async function detachTarget(target: CDPTarget) {
    try {
      await connectionStore.disconnectTarget(target.id);
      if (targetsStore.selectedTarget?.id === target.id) targetsStore.selectTarget(null);
      toast.info("Target detached");
    } catch (error) {
      toast.error("Could not detach", { description: String(error) });
    }
  }

  async function learnPageIdentity(target: CDPTarget, url: string) {
    try {
      const ready = await localWebviewStore.ensureCdpTarget(target);
      const client = await connectToTarget(ready);
      pageHistory.describe(url, await readLocalPageIdentity(client));
    } catch (error) {
      console.warn("Could not read the title and icon of the local page", url, error);
    }
  }

  async function createLocalTarget(rawUrl: string): Promise<string | null> {
    const url = normalizeInspectableUrl(rawUrl);
    if (!url) {
      toast.error("Enter a valid URL", { description: "For example http://localhost:5173" });
      return null;
    }
    creatingLocal.value = true;
    try {
      const target = targetsStore.createLocalTarget(url);
      pageHistory.record(url);
      await selectTarget(target);
      void learnPageIdentity(target, url);
      return url;
    } catch (error) {
      toast.error("Could not open the local page", { description: String(error) });
      return null;
    } finally {
      creatingLocal.value = false;
    }
  }

  return {
    selectedTargetId,
    deviceTargets,
    appTargets,
    groups,
    localTargets,
    isScanning,
    isScanningApps,
    creatingLocal,
    refreshTargets,
    selectTarget,
    inspectTarget,
    removeLocalTarget,
    detachTarget,
    createLocalTarget,
  };
}
