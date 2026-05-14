import { computed, ref } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import type { CDPTarget } from "@/types/cdp.types";
import type { ConnectionSource } from "@/types/connection.types";
import type { SessionTargetSnapshot } from "@/types/session.types";
import { listTargetsEffect, refreshTargetsEffect, runSessionEffect } from "@/runtime/session";
import { useSourceStore } from "@/stores/source.store";
import { useConnectionStore } from "@/stores/connection.store";
import {
  restoreSelectedTargetUrl,
  saveSelectedTargetUrl,
} from "@/composables/useSessionPersistence";

interface RawCDPTarget {
  id: string;
  type: string;
  title: string;
  url: string;
  devtoolsFrontendUrl?: string;
  webSocketDebuggerUrl: string;
  faviconUrl?: string;
  packageName?: string;
}

function mapRawTargetToCDP(source: ConnectionSource, target: RawCDPTarget): CDPTarget {
  return {
    id: target.id,
    type: (target.type as CDPTarget["type"]) || "page",
    title: target.title,
    url: target.url,
    devtoolsFrontendUrl: target.devtoolsFrontendUrl,
    webSocketDebuggerUrl: target.webSocketDebuggerUrl,
    source: source.type,
    deviceSerial: source.type === "adb" ? source.serial : undefined,
    faviconUrl: target.faviconUrl,
    packageName: target.packageName,
  };
}

function mapSessionTargetToCDP(target: SessionTargetSnapshot): CDPTarget {
  return {
    id: target.id,
    type: (target.type as CDPTarget["type"]) || "page",
    title: target.title,
    url: target.url,
    devtoolsFrontendUrl: target.devtoolsFrontendUrl,
    webSocketDebuggerUrl: target.webSocketDebuggerUrl,
    source: "adb",
    deviceSerial: target.serial,
    faviconUrl: target.faviconUrl,
    packageName: target.packageName,
    isStale: target.isStale,
    lastUpdatedAt: target.lastUpdatedAt,
  };
}

export const useTargetsStore = defineStore("targets", () => {
  const sourceStore = useSourceStore();
  const connectionStore = useConnectionStore();
  const targets = ref<CDPTarget[]>([]);
  const selectedTarget = ref<CDPTarget | null>(null);
  const fetchingSources = ref<Set<string>>(new Set());
  const error = ref<string | null>(null);

  const cdpTargetId = computed(() => {
    const t = selectedTarget.value;
    if (!t) return "";
    if (t.source === "local") return t.webSocketDebuggerUrl ? t.id : "";
    return t.id;
  });

  function localTargetLabel(id: string) {
    return `local-preview-${id.replace(/[^a-zA-Z0-9_:/-]/g, "-")}`;
  }

  function createLocalTargetSnapshot(url: string, id = crypto.randomUUID()): CDPTarget {
    let title = url;
    try {
      const parsed = new URL(url);
      title = parsed.host || url;
    } catch {}

    return {
      id: `local:${id}`,
      type: "page",
      title,
      url,
      source: "local",
      localWebviewLabel: localTargetLabel(id),
      lastUpdatedAt: Date.now(),
    };
  }

  function isSameTargetSignature(a: CDPTarget, b: CDPTarget) {
    if (a.source !== b.source) return false;
    if ((a.deviceSerial ?? null) !== (b.deviceSerial ?? null)) return false;
    if (a.url && b.url) return a.url === b.url;
    return a.title === b.title && (a.packageName ?? "") === (b.packageName ?? "");
  }

  function replaceTargetsForSource(source: ConnectionSource, nextTargets: CDPTarget[]) {
    if (source.type === "adb") {
      targets.value = targets.value
        .filter((target) => target.deviceSerial !== source.serial)
        .concat(nextTargets);
      return;
    }

    targets.value = targets.value
      .filter((target) => target.source !== source.type)
      .concat(nextTargets);
  }

  function reconcileSelectedTarget() {
    const currentSelected = selectedTarget.value;
    if (!currentSelected) {
      return;
    }

    const replacement =
      targets.value.find((target) => target.id === currentSelected.id) ??
      targets.value.find((target) => isSameTargetSignature(currentSelected, target));
    if (replacement) {
      selectedTarget.value = replacement;
    }
  }

  function restorePersistedTargetSelection() {
    if (externalTargetOwned()) {
      return;
    }
    if (selectedTarget.value || connectionStore.activeConnection) {
      return;
    }

    const savedUrl = restoreSelectedTargetUrl();
    if (!savedUrl) {
      return;
    }

    const match = visibleTargets.value.find((target) => target.url === savedUrl);
    if (match) {
      selectedTarget.value = match;
    }
  }

  function externalTargetOwned() {
    return connectionStore.externalDevtoolsTargetId !== null;
  }

  async function hydrateAdbTargets(serial: string) {
    error.value = null;
    try {
      const source: ConnectionSource = { type: "adb", serial };
      const snapshots = await runSessionEffect(listTargetsEffect(serial), {
        operation: "session.listTargets",
      });
      replaceTargetsForSource(
        source,
        snapshots.map((target) => mapSessionTargetToCDP(target)),
      );
      reconcileSelectedTarget();
      restorePersistedTargetSelection();
    } catch (err) {
      error.value = String(err);
    }
  }

  async function fetchTargetsForSource(source: ConnectionSource) {
    if (source.type === "local") {
      return;
    }

    const key = source.type === "adb" ? `adb:${source.serial}` : `chrome:${source.port}`;
    if (fetchingSources.value.has(key)) return;

    fetchingSources.value.add(key);
    error.value = null;

    try {
      let raw: RawCDPTarget[] = [];

      if (source.type === "chrome") {
        raw = await invoke<RawCDPTarget[]>("chrome_fetch_targets", {
          port: source.port,
        });
      } else {
        const snapshots = await runSessionEffect(refreshTargetsEffect(source.serial), {
          operation: "session.refreshTargets",
        });
        replaceTargetsForSource(
          source,
          snapshots.map((target) => mapSessionTargetToCDP(target)),
        );
        reconcileSelectedTarget();
        restorePersistedTargetSelection();
        return;
      }

      const enriched = raw.map((target) => mapRawTargetToCDP(source, target));
      replaceTargetsForSource(source, enriched);
      reconcileSelectedTarget();
      restorePersistedTargetSelection();
    } catch (err) {
      error.value = String(err);
    } finally {
      fetchingSources.value.delete(key);
    }
  }

  function selectTarget(target: CDPTarget | null) {
    selectedTarget.value = target;
    if (target) {
      saveSelectedTargetUrl(target.url);
    }
  }

  async function createChromeTarget(url: string, port: number) {
    const rawTarget = await invoke<RawCDPTarget>("chrome_open_target", {
      port,
      url,
    });
    const source: ConnectionSource = {
      type: "chrome",
      port,
      mode: "manual",
    };
    const target = mapRawTargetToCDP(source, rawTarget);
    targets.value = targets.value.filter((existing) => existing.id !== target.id).concat(target);
    selectTarget(target);
    return target;
  }

  function createLocalTarget(url: string) {
    const existing = targets.value.find(
      (target) => target.source === "local" && target.url === url,
    );
    if (existing) {
      selectTarget(existing);
      return existing;
    }

    const target = createLocalTargetSnapshot(url);
    targets.value = targets.value.concat(target);
    selectTarget(target);
    return target;
  }

  function updateLocalTargetCdp(targetId: string, webSocketDebuggerUrl: string) {
    targets.value = targets.value.map((t) =>
      t.id === targetId ? { ...t, webSocketDebuggerUrl } : t,
    );
    if (selectedTarget.value?.id === targetId) {
      selectedTarget.value = { ...selectedTarget.value, webSocketDebuggerUrl };
    }
  }

  function removeTarget(targetId: string) {
    targets.value = targets.value.filter((target) => target.id !== targetId);
    if (selectedTarget.value?.id === targetId) {
      selectedTarget.value = null;
    }
  }

  function clearTargetsForSerial(serial: string) {
    targets.value = targets.value.filter((t) => t.deviceSerial !== serial);
    if (selectedTarget.value?.deviceSerial === serial) {
      selectedTarget.value = null;
    }
  }

  function clearAllTargets() {
    targets.value = [];
    selectedTarget.value = null;
  }

  const visibleTargets = computed(() => {
    const activeAdbSerial = sourceStore.getAdbSource()?.serial ?? null;
    const hasChromeSource = sourceStore.hasChromeSource;

    return targets.value.filter((target) => {
      if (target.source === "adb") {
        return target.deviceSerial === activeAdbSerial;
      }
      if (target.source === "local") {
        return true;
      }
      return hasChromeSource;
    });
  });

  return {
    targets,
    visibleTargets,
    selectedTarget,
    cdpTargetId,
    fetchingSources,
    error,
    hydrateAdbTargets,
    fetchTargetsForSource,
    createChromeTarget,
    createLocalTarget,
    updateLocalTargetCdp,
    removeTarget,
    selectTarget,
    clearTargetsForSerial,
    clearAllTargets,
  };
});
