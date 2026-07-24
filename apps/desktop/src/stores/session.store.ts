import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import type { ADBDevice } from "@/types/adb.types";
import type {
  SessionDeviceSnapshot,
  SessionEvent,
  SessionRegistrySnapshot,
  SessionTrackerStatus,
} from "@/types/session.types";
import {
  getRegistryStateEffect,
  refreshDevicesEffect,
  runSessionEffect,
  setActiveDeviceEffect,
  subscribeSessionEventsEffect,
} from "@/runtime/session";

function createEmptyRegistry(): SessionRegistrySnapshot {
  return {
    devices: [],
    activeSerial: null,
    trackerStatus: "stopped",
    revision: 0,
    lastError: null,
    updatedAt: 0,
  };
}

function normalizeStatus(status: SessionDeviceSnapshot["status"]): ADBDevice["status"] {
  if (status === "online") return "online";
  if (status === "unauthorized") return "unauthorized";
  if (status === "no_perm") return "no-permissions";
  return "offline";
}

function toAdbDevice(device: SessionDeviceSnapshot): ADBDevice {
  return {
    serial: device.serial,
    model: device.model,
    product: device.product,
    transportId: device.transportId,
    deviceKind: device.deviceKind,
    connectionType: device.connectionType === "wifi" ? "wifi" : "usb",
    status: normalizeStatus(device.status),
    isStale: device.isStale,
    lastSeenAt: device.lastSeenAt,
    lastUpdatedAt: device.lastUpdatedAt,
  };
}

function withOptimisticActiveSerial(
  registry: SessionRegistrySnapshot,
  activeSerial: string | null,
): SessionRegistrySnapshot {
  return {
    ...registry,
    activeSerial,
    revision: registry.revision + 1,
    devices: registry.devices.map((device) => ({
      ...device,
      temperature:
        !device.isStale && device.serial === activeSerial
          ? "hot"
          : device.isStale
            ? "cold"
            : "warm",
    })),
  };
}

export const useSessionStore = defineStore("session", () => {
  const registry = ref<SessionRegistrySnapshot>(createEmptyRegistry());
  const isInitialized = ref(false);
  const isInitializing = ref(false);
  const unlisten = shallowRef<null | (() => void)>(null);

  let initializePromise: Promise<void> | null = null;

  const devices = computed(() => registry.value.devices.map(toAdbDevice));
  const selectedDevice = computed(
    () => devices.value.find((device) => device.serial === registry.value.activeSerial) ?? null,
  );
  const onlineDevices = computed(() =>
    devices.value.filter((device) => device.status === "online"),
  );
  const trackerStatus = computed<SessionTrackerStatus>(() => registry.value.trackerStatus);
  const lastError = computed(() => registry.value.lastError);

  function applySnapshot(snapshot: SessionRegistrySnapshot) {
    registry.value = snapshot;
    isInitialized.value = true;
  }

  function handleSessionEvent(event: SessionEvent) {
    if (event.type === "registryUpdated") {
      applySnapshot(event.snapshot);
    }
  }

  async function initialize() {
    if (isInitialized.value) {
      return;
    }

    if (initializePromise) {
      return initializePromise;
    }

    isInitializing.value = true;
    initializePromise = (async () => {
      if (!unlisten.value) {
        unlisten.value = await runSessionEffect(subscribeSessionEventsEffect(handleSessionEvent), {
          operation: "session.subscribe",
        });
      }
      const snapshot = await runSessionEffect(getRegistryStateEffect(), {
        operation: "session.getRegistryState",
      });
      applySnapshot(snapshot);
    })().finally(() => {
      isInitializing.value = false;
      initializePromise = null;
    });

    return initializePromise;
  }

  async function refreshDevices() {
    await initialize();
    const snapshot = await runSessionEffect(refreshDevicesEffect(), {
      operation: "session.refreshDevices",
    });
    applySnapshot(snapshot);
    return snapshot;
  }

  async function setActiveDevice(serial: string | null) {
    await initialize();
    const previous = registry.value;
    applySnapshot(withOptimisticActiveSerial(previous, serial));
    try {
      const snapshot = await runSessionEffect(setActiveDeviceEffect(serial), {
        operation: "session.setActiveDevice",
      });
      applySnapshot(snapshot);
      return snapshot;
    } catch (error) {
      registry.value = previous;
      throw error;
    }
  }

  async function dispose() {
    const stopListening = unlisten.value;
    unlisten.value = null;
    if (stopListening) {
      stopListening();
    }
    isInitialized.value = false;
  }

  return {
    registry,
    devices,
    selectedDevice,
    onlineDevices,
    trackerStatus,
    lastError,
    isInitialized,
    isInitializing,
    initialize,
    refreshDevices,
    setActiveDevice,
    dispose,
  };
});
