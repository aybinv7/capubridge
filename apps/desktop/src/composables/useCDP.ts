import { computed } from "vue";
import { useDevicesStore } from "@/stores/devices.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useConnectionStore } from "@/stores/connection.store";
import { useSourceStore } from "@/stores/source.store";
import type { CDPTarget } from "@/types/cdp.types";
import type { ConnectionSource } from "@/types/connection.types";
import { CDPClient } from "@capubridge/cdp-protocol";

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
