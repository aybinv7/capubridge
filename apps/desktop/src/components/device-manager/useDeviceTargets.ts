import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "@/lib/toast";
import { useConnectionStore } from "@/stores/connection.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useTargetActivation } from "@/composables/useTargetActivation";
import { useAdb } from "@/composables/useAdb";
import { useAppPackages } from "@/composables/useAppPackages";
import { isNativeAppTarget } from "@/lib/app-target";
import type { CDPTarget } from "@/types/cdp.types";
import type { DeviceManagerState } from "./useDeviceManager";
import { groupTargetsByApp, isUnansweredSocket } from "./targetGroups";

/** An app takes a moment to start and open its WebView: scan this many times, this far apart. */
const OPEN_SCANS = 4;
const OPEN_SCAN_GAP_MS = 1200;

/** Targets on the viewed device, and every action on them. This PC's pages are its tabs. */
export function useDeviceTargets(manager: DeviceManagerState, close: () => void) {
  const router = useRouter();
  const targetsStore = useTargetsStore();
  const connectionStore = useConnectionStore();
  const { activateTarget } = useTargetActivation();
  const { openPackage } = useAdb();
  const { getCachedPackage } = useAppPackages(computed(() => manager.viewedSerial.value ?? ""));

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

  function pageOfApp(serial: string, packageName: string): CDPTarget | null {
    return (
      targetsStore.targets.find(
        (target) =>
          target.source === "adb" &&
          target.deviceSerial === serial &&
          target.packageName === packageName &&
          !isNativeAppTarget(target) &&
          !isUnansweredSocket(target),
      ) ?? null
    );
  }

  /**
   * A WebView socket with no page behind it usually means the app is not open: there is nothing
   * to attach to yet. Opens the app on the phone, scans again while it starts, and attaches to
   * its page once one shows, instead of failing on an address with no page in it.
   */
  async function openAppAndAttach(target: CDPTarget) {
    const serial = target.deviceSerial;
    const packageName = target.packageName;
    if (!serial || !packageName) {
      toast.info("This WebView has no page open", {
        description: "Open the app on the phone, then scan again.",
      });
      return;
    }
    const app = getCachedPackage(packageName)?.label ?? packageName;
    const toastId = toast.loading(`Opening ${app} on the phone…`);
    try {
      await openPackage(serial, packageName);
      for (let attempt = 0; attempt < OPEN_SCANS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, OPEN_SCAN_GAP_MS));
        await refreshTargets();
        const page = pageOfApp(serial, packageName);
        if (page) {
          toast.dismiss(toastId);
          await selectTarget(page);
          return;
        }
      }
      toast.info(`${app} is open, but shows no web page yet`, {
        id: toastId,
        description: "Go to a screen of the app with web content, then pick its page here.",
      });
    } catch (error) {
      toast.error(`Could not open ${app} on the phone`, {
        id: toastId,
        description: String(error),
      });
    }
  }

  async function selectTarget(target: CDPTarget) {
    if (isUnansweredSocket(target)) {
      await openAppAndAttach(target);
      return;
    }
    try {
      await manager.withPollingPaused(() => activateTarget(target));
      close();
    } catch (error) {
      toast.error("Could not attach to the page", { description: String(error) });
    }
  }

  /** Attaches to the page and opens its full Chrome DevTools, docked. */
  async function inspectTarget(target: CDPTarget) {
    if (isUnansweredSocket(target)) {
      await openAppAndAttach(target);
      return;
    }
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
