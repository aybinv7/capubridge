import { computed, watch } from "vue";
import { defineStore } from "pinia";
import { useSessionStore } from "@/stores/session.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useConnectionStore } from "@/stores/connection.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useDeviceNamesStore } from "@/stores/deviceNames.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { deriveLinkHealth, presentLink } from "@/lib/gates/link";
import type { GateInput, GateLinkStatus } from "@/lib/gates/types";
import type { CDPConnection } from "@/types/cdp.types";
import { isNativeAppTarget } from "@/lib/app-target";

export type ActiveContextKind = "none" | "device" | "adb-target" | "local" | "chrome";
export type ActiveTargetStatus = "none" | "idle" | CDPConnection["status"];

/**
 * Single owner of the "what am I looking at" rules. Device and target selection
 * stay in their stores; this store keeps them consistent and exposes the derived
 * context every surface should read.
 */
export const useActiveContextStore = defineStore("active-context", () => {
  const sessionStore = useSessionStore();
  const targetsStore = useTargetsStore();
  const connectionStore = useConnectionStore();
  const devicesStore = useDevicesStore();
  const deviceNames = useDeviceNamesStore();
  const presenceStore = useTargetPresenceStore();

  const device = computed(() => sessionStore.selectedDevice);
  const target = computed(() => targetsStore.selectedTarget);

  const kind = computed<ActiveContextKind>(() => {
    const selected = target.value;
    if (selected?.source === "local") return "local";
    if (selected?.source === "chrome") return "chrome";
    if (selected?.source === "adb") return "adb-target";
    return device.value ? "device" : "none";
  });

  const targetStatus = computed<ActiveTargetStatus>(() => {
    const selected = target.value;
    if (!selected) return "none";
    return connectionStore.connections.get(selected.id)?.status ?? "idle";
  });

  const isTargetConnected = computed(() => targetStatus.value === "connected");

  const linkStatus = computed<GateLinkStatus>(() => {
    const status = targetStatus.value;
    const selected = target.value;
    if (!selected) return "none";
    if (status === "connected" || status === "connecting") return status;
    return connectionStore.failures.has(selected.id) ? "error" : status;
  });

  const linkError = computed(() => {
    const selected = target.value;
    return selected ? (connectionStore.failures.get(selected.id) ?? null) : null;
  });

  const link = computed(() =>
    presentLink(
      deriveLinkHealth(
        target.value?.source ?? null,
        linkStatus.value,
        presenceStore.presence,
        isNativeAppTarget(target.value),
      ),
    ),
  );

  /** Everything a gate needs, read from the one owner of the active context. */
  const gateInput = computed<GateInput>(() => {
    const selected = target.value;
    const selectedDevice = device.value;
    return {
      adb: devicesStore.adbServerStatus,
      onlineDevices: devicesStore.onlineDevices.length,
      device: selectedDevice
        ? {
            serial: selectedDevice.serial,
            model: selectedDevice.model,
            name: deviceNames.nameOf(selectedDevice),
            status: selectedDevice.status,
            isStale: selectedDevice.isStale,
          }
        : null,
      target: selected
        ? {
            id: selected.id,
            source: selected.source,
            title: selected.title?.trim() || selected.url,
            packageName: selected.packageName,
            native: isNativeAppTarget(selected),
          }
        : null,
      link: linkStatus.value,
      linkError: linkError.value,
      presence: presenceStore.presence,
    };
  });

  async function alignDeviceToTarget() {
    const selected = target.value;
    if (!selected) return;
    const activeSerial = sessionStore.registry.activeSerial;
    const wantedSerial = selected.source === "adb" ? (selected.deviceSerial ?? null) : null;
    if (wantedSerial === activeSerial) return;
    try {
      await sessionStore.setActiveDevice(wantedSerial);
    } catch (error) {
      console.warn("Failed to align the active device with the selected target", error);
    }
  }

  function dropTargetForeignToDevice(serial: string | null) {
    const selected = target.value;
    if (!serial || !selected) return;
    if (selected.source === "adb" && selected.deviceSerial === serial) return;
    targetsStore.selectTarget(null);
  }

  watch(
    () => target.value?.id ?? null,
    (targetId) => {
      connectionStore.selectedTargetId = targetId;
      void alignDeviceToTarget();
    },
    { immediate: true },
  );

  watch(
    () => sessionStore.registry.activeSerial,
    (serial, previous) => {
      if (serial !== previous) {
        dropTargetForeignToDevice(serial);
      }
    },
  );

  return {
    device,
    target,
    kind,
    targetStatus,
    isTargetConnected,
    link,
    gateInput,
  };
});
