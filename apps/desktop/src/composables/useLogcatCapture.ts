import { onScopeDispose, watch } from "vue";
import { useDevicesStore } from "@/stores/devices.store";
import { useLogcatStore } from "@/stores/logcat.store";
import { useSessionStore } from "@/stores/session.store";
import { useTargetsStore } from "@/stores/targets.store";

/**
 * Keeps this window's logcat capture on the active device for as long as the calling scope
 * lives. Mount it once per window (the shell, or a popped-out Logcat window); views only read
 * the store. The capture follows the device across offline and online transitions.
 */
export function useLogcatCapture() {
  const sessionStore = useSessionStore();
  const devicesStore = useDevicesStore();
  const logcatStore = useLogcatStore();
  const targetsStore = useTargetsStore();

  function report(error: unknown) {
    logcatStore.error = `Logcat capture failed: ${error instanceof Error ? error.message : String(error)}`;
  }

  void sessionStore.initialize().catch((error: unknown) => {
    logcatStore.error = `Could not read the device list: ${error instanceof Error ? error.message : String(error)}`;
  });

  watch(
    () => {
      const device = devicesStore.selectedDevice;
      return [device?.serial ?? null, device?.status === "online"] as const;
    },
    ([serial, online]) => {
      logcatStore.follow(serial, online).catch(report);
    },
    { immediate: true },
  );

  watch(
    () => targetsStore.selectedTarget?.packageName ?? null,
    (packageName) => logcatStore.setWatchedPackage(packageName),
    { immediate: true },
  );

  onScopeDispose(() => {
    logcatStore.follow(null).catch(report);
  });
}
