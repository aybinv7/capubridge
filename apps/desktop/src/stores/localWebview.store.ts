import { computed, ref, shallowRef } from "vue";
import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";
import { LogicalPosition, LogicalSize } from "@tauri-apps/api/dpi";
import type { Webview } from "@tauri-apps/api/webview";
import type { CDPTarget } from "@/types/cdp.types";
import { useTargetsStore } from "@/stores/targets.store";

export interface LocalWebviewBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LocalWebviewEntry {
  label: string;
  targetId: string;
  url: string;
  status: "creating" | "ready" | "error";
  error: string | null;
}

type LocalWebviewTarget = CDPTarget & { localWebviewLabel: string };

function isLocalTarget(target: CDPTarget | null | undefined): target is LocalWebviewTarget {
  return target?.source === "local" && !!target.localWebviewLabel;
}

function readElementBounds(element: HTMLElement): LocalWebviewBounds {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(0, Math.round(rect.left)),
    y: Math.max(0, Math.round(rect.top)),
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}

async function parkWebview(webview: Webview) {
  await webview.setSize(new LogicalSize(1, 1)).catch(() => null);
  await webview.setPosition(new LogicalPosition(-32000, -32000)).catch(() => null);
  await webview.hide().catch(() => null);
}

async function injectScrollbarHide(webview: Webview) {
  await invoke("local_webview_inject_scrollbar_hide", { label: webview.label }).catch(() => null);
}

async function fetchLocalCdpTarget(url: string) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const info = await invoke<{ webSocketDebuggerUrl?: string } | null>(
      "local_webview_fetch_cdp_target",
      { targetUrl: url },
    ).catch(() => null);
    if (info?.webSocketDebuggerUrl) {
      return info;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 150));
  }
  return null;
}

export const useLocalWebviewStore = defineStore("local-webview", () => {
  const targetsStore = useTargetsStore();
  const activeTargetId = ref<string | null>(null);
  const layoutRevision = ref(0);
  const entries = ref<Record<string, LocalWebviewEntry>>({});
  const webviews = shallowRef(new Map<string, Webview>());
  const creationPromises = new Map<string, Promise<Webview>>();
  const modalGuardCount = ref(0);

  if (typeof window !== "undefined") {
    const destroyAll = () => {
      for (const [, webview] of webviews.value) {
        try {
          void webview.close();
        } catch {
          /* webview may already be gone */
        }
      }
    };
    window.addEventListener("beforeunload", destroyAll);
    window.addEventListener("pagehide", destroyAll);
    if (import.meta.hot) {
      import.meta.hot.dispose(destroyAll);
    }
  }

  const activeEntry = computed(() =>
    activeTargetId.value ? (entries.value[activeTargetId.value] ?? null) : null,
  );

  function setEntry(target: CDPTarget, next: Partial<LocalWebviewEntry>) {
    if (!target.localWebviewLabel) return;
    entries.value = {
      ...entries.value,
      [target.id]: {
        ...entries.value[target.id],
        label: target.localWebviewLabel,
        targetId: target.id,
        url: target.url,
        status: "creating",
        error: null,
        ...next,
      },
    };
  }

  async function ensureWebview(target: CDPTarget) {
    if (!isLocalTarget(target)) {
      throw new Error("Target is not a local webview target.");
    }

    const pending = creationPromises.get(target.localWebviewLabel);
    if (pending) {
      return pending;
    }

    const existing = webviews.value.get(target.localWebviewLabel);
    if (existing) {
      return existing;
    }

    setEntry(target, { status: "creating", error: null });
    const [{ Webview }, { getCurrentWindow }] = await Promise.all([
      import("@tauri-apps/api/webview"),
      import("@tauri-apps/api/window"),
    ]);
    const parent = getCurrentWindow();
    const webview = new Webview(parent, target.localWebviewLabel, {
      url: target.url,
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      devtools: true,
      focus: false,
      dragDropEnabled: false,
    });

    const next = new Map(webviews.value);
    next.set(target.localWebviewLabel, webview);
    webviews.value = next;

    const creation = new Promise<Webview>((resolve, reject) => {
      void webview.once("tauri://created", async () => {
        setEntry(target, { status: "ready", error: null });
        void webview.hide().catch(() => null);
        await injectScrollbarHide(webview);
        const info = await fetchLocalCdpTarget(target.url);
        if (info?.webSocketDebuggerUrl) {
          targetsStore.updateLocalTargetCdp(target.id, info.webSocketDebuggerUrl);
        }
        resolve(webview);
      });
      void webview.once<string>("tauri://error", (event) => {
        const message = String(event.payload);
        setEntry(target, { status: "error", error: message });
        reject(new Error(message));
      });
    }).finally(() => {
      creationPromises.delete(target.localWebviewLabel);
    });

    creationPromises.set(target.localWebviewLabel, creation);
    return creation;
  }

  async function attachToElement(target: CDPTarget, element: HTMLElement) {
    if (!isLocalTarget(target)) {
      return;
    }

    const webview = await ensureWebview(target);

    // Maintain the invariant that only one local webview is visible at a time.
    // Without this, switching targets leaves the previous webview painted
    // beneath/around the new one.
    const parkOthers = Array.from(webviews.value.entries())
      .filter(([label]) => label !== target.localWebviewLabel)
      .map(([, other]) => parkWebview(other));
    await Promise.all(parkOthers);

    const bounds = readElementBounds(element);
    activeTargetId.value = target.id;
    await webview.setPosition(new LogicalPosition(bounds.x, bounds.y));
    await webview.setSize(new LogicalSize(bounds.width, bounds.height));
    await webview.show();
  }

  async function resizeToElement(target: CDPTarget, element: HTMLElement) {
    if (!isLocalTarget(target)) {
      return;
    }

    const webview = webviews.value.get(target.localWebviewLabel);
    if (!webview || activeTargetId.value !== target.id) {
      return;
    }

    const bounds = readElementBounds(element);
    await webview.setPosition(new LogicalPosition(bounds.x, bounds.y));
    await webview.setSize(new LogicalSize(bounds.width, bounds.height));
  }

  async function hideTarget(target: CDPTarget | null | undefined) {
    if (!isLocalTarget(target)) {
      return;
    }

    const webview = webviews.value.get(target.localWebviewLabel);
    if (webview) {
      await parkWebview(webview);
    }
    if (activeTargetId.value === target.id) {
      activeTargetId.value = null;
    }
    targetsStore.removeTarget(target.id);
  }

  async function hideAll() {
    const pending = Array.from(webviews.value.values()).map((webview) => parkWebview(webview));
    await Promise.all(pending);
    activeTargetId.value = null;
  }

  async function ensureCdpTarget(target: CDPTarget) {
    if (!isLocalTarget(target)) {
      throw new Error("Target is not a local webview target.");
    }
    await ensureWebview(target);
    const current = targetsStore.targets.find((entry) => entry.id === target.id) ?? target;
    if (current.webSocketDebuggerUrl) {
      return current;
    }
    const info = await fetchLocalCdpTarget(target.url);
    if (info?.webSocketDebuggerUrl) {
      targetsStore.updateLocalTargetCdp(target.id, info.webSocketDebuggerUrl);
      return (
        targetsStore.targets.find((entry) => entry.id === target.id) ?? {
          ...current,
          webSocketDebuggerUrl: info.webSocketDebuggerUrl,
        }
      );
    }
    return current;
  }

  async function closeTarget(target: CDPTarget | null | undefined) {
    if (!isLocalTarget(target)) {
      return;
    }

    const webview = webviews.value.get(target.localWebviewLabel);
    if (webview) {
      await webview.close().catch(() => null);
    }
    const next = new Map(webviews.value);
    next.delete(target.localWebviewLabel);
    webviews.value = next;
    const nextEntries = { ...entries.value };
    delete nextEntries[target.id];
    entries.value = nextEntries;
    if (activeTargetId.value === target.id) {
      activeTargetId.value = null;
    }
  }

  async function openDevtools(target: CDPTarget) {
    if (!isLocalTarget(target)) {
      throw new Error("Target is not a local webview target.");
    }
    await ensureWebview(target);
    await invoke<void>("local_webview_open_devtools", { label: target.localWebviewLabel });
  }

  async function localDeviceName() {
    return invoke<string>("local_device_name");
  }

  function requestLayoutSync() {
    layoutRevision.value += 1;
  }

  async function navigateSource(label: string, url: string): Promise<void> {
    await invoke("local_webview_navigate", { label, url });
  }

  function acquireModalGuard() {
    modalGuardCount.value += 1;
    void hideAll();
  }

  function releaseModalGuard() {
    modalGuardCount.value = Math.max(0, modalGuardCount.value - 1);
    if (modalGuardCount.value === 0) {
      layoutRevision.value += 1;
    }
  }

  return {
    activeTargetId,
    layoutRevision,
    activeEntry,
    entries,
    modalGuardCount,
    ensureWebview,
    ensureCdpTarget,
    attachToElement,
    resizeToElement,
    hideTarget,
    hideAll,
    closeTarget,
    openDevtools,
    localDeviceName,
    requestLayoutSync,
    acquireModalGuard,
    releaseModalGuard,
    navigateSource,
  };
});
