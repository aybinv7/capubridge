import { onScopeDispose, watch } from "vue";
import { useDevicesStore } from "@/stores/devices.store";
import { useLogcatStore } from "@/stores/logcat.store";
import { useSessionStore } from "@/stores/session.store";

/**
 * Keeps this window's logcat capture on the active device for as long as the calling scope
 * lives. Mount it once per window (the shell, or a popped-out Logcat window); views only read
 * the store. The capture follows the device across offline and online transitions.
 */
export function useLogcatCapture() {
  const sessionStore = useSessionStore();
  const devicesStore = useDevicesStore();
  const logcatStore = useLogcatStore();

  void sessionStore.initialize().catch((error: unknown) => {
    logcatStore.error = `Could not read the device list: ${error instanceof Error ? error.message : String(error)}`;
  });

  watch(
    () => {
      const device = devicesStore.selectedDevice;
      return [device?.serial ?? null, device?.status === "online"] as const;
    },
    ([serial, online]) => {
      void logcatStore.follow(serial, online);
    },
    { immediate: true },
  );

  onScopeDispose(() => {
    void logcatStore.follow(null);
  });
}
