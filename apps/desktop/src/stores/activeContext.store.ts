import { computed, watch } from "vue";
import { defineStore } from "pinia";
import { useSessionStore } from "@/stores/session.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useConnectionStore } from "@/stores/connection.store";
import type { CDPConnection } from "@/types/cdp.types";

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
  };
});
