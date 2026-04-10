import { computed, watch } from "vue";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useConnectionStore } from "@/stores/connection.store";
import { useSourceStore } from "@/stores/source.store";
import type { CDPTarget } from "@/types/cdp.types";
import type { ConnectionSource } from "@/types/connection.types";
import { CDPClient } from "utils";

export function useCDP() {
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const connectionStore = useConnectionStore();
  const sourceStore = useSourceStore();

  const activeClient = computed<CDPClient | null>(() => {
    const conn = connectionStore.activeConnection;
    if (!conn || conn.status !== "connected") return null;
    return connectionStore.getClient(conn.targetId) ?? null;
  });

  async function fetchTargetsForSource(source: ConnectionSource) {
    await targetsStore.fetchTargetsForSource(source);
  }

  async function refreshTargets() {
    for (const source of sourceStore.activeSources) {
      await fetchTargetsForSource(source);
    }
  }

  async function connectToTarget(target: CDPTarget): Promise<CDPClient> {
    return connectionStore.connect(target);
  }

  function getClient(targetId: string): CDPClient | undefined {
    return connectionStore.getClient(targetId);
  }

  function disconnectTarget(targetId: string) {
    void connectionStore.disconnectTarget(targetId);
  }

  return {
    activeClient,
    devicesStore,
    targetsStore,
    connectionStore,
    sourceStore,
    fetchTargetsForSource,
    refreshTargets,
    connectToTarget,
    getClient,
    disconnectTarget,
  };
}

export function initCDPWatchers() {
  const devicesStore = useDevicesStore();
  const targetsStore = useTargetsStore();
  const connectionStore = useConnectionStore();
  const sourceStore = useSourceStore();
  let selectionRun = 0;

  watch(
    () => devicesStore.selectedDevice,
    async (device, previousDevice) => {
      const runId = ++selectionRun;
      const oldSerial = sourceStore.getAdbSource()?.serial ?? null;
      const selectedTargetId = targetsStore.selectedTarget?.id ?? null;

      if (device?.status === "online") {
        if (oldSerial && oldSerial !== device.serial) {
          if (selectedTargetId) {
            await connectionStore.disconnectTarget(selectedTargetId);
          }
          if (runId !== selectionRun) return;
          await sourceStore.addAdbSource(device.serial);
          if (runId !== selectionRun) return;

          const source = sourceStore.getAdbSource();
          if (source) {
            await targetsStore.fetchTargetsForSource(source);
            if (runId !== selectionRun) return;
          }

          const hasNewTargets = targetsStore.targets.some((t) => t.deviceSerial === device.serial);
          if (hasNewTargets) {
            targetsStore.clearTargetsForSerial(oldSerial);
          }
        } else {
          await sourceStore.addAdbSource(device.serial);
          if (runId !== selectionRun) return;
          const source = sourceStore.getAdbSource();
          if (source) {
            await targetsStore.fetchTargetsForSource(source);
            if (runId !== selectionRun) return;
          }
        }
      } else if (previousDevice && !device) {
        const currentSerial = sourceStore.getAdbSource()?.serial ?? null;
        if (selectedTargetId) {
          await connectionStore.disconnectTarget(selectedTargetId);
        }
        if (runId !== selectionRun) return;
        if (currentSerial) targetsStore.clearTargetsForSerial(currentSerial);
        await sourceStore.removeAdbSource();
      }
    },
  );

  watch(
    () => sourceStore.getChromeSource(),
    async (chromeSource) => {
      if (chromeSource) {
        await targetsStore.fetchTargetsForSource(chromeSource);
      }
    },
  );
}
