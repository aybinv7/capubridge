import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "@/lib/toast";
import { useConnectionStore } from "@/stores/connection.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useTargetActivation } from "@/composables/useTargetActivation";
import { isNativeAppTarget } from "@/lib/app-target";
import type { CDPTarget } from "@/types/cdp.types";
import type { DeviceManagerState } from "./useDeviceManager";
import { groupTargetsByApp } from "./targetGroups";

/** Targets on the viewed device, and every action on them. This PC's pages are its tabs. */
export function useDeviceTargets(manager: DeviceManagerState, close: () => void) {
  const router = useRouter();
  const targetsStore = useTargetsStore();
  const connectionStore = useConnectionStore();
  const { activateTarget } = useTargetActivation();

  const scanning = ref(false);

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

  /** Attaches to the page and opens its full Chrome DevTools, docked. */
  async function inspectTarget(target: CDPTarget) {
    try {
      await activateTarget(target);
      close();
      await router.push("/devtools/chrome");
    } catch (error) {
      toast.error("Could not open DevTools for the page", { description: String(error) });
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

  return {
    selectedTargetId,
    deviceTargets,
    appTargets,
    groups,
    isScanning,
    isScanningApps,
    refreshTargets,
    selectTarget,
    inspectTarget,
    detachTarget,
  };
}
