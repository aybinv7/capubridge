import { LocalStorageDomain } from "utils";
import type { CDPClient } from "utils";
import type { useSessionWriter } from "./useSessionWriter";

type SessionWriter = ReturnType<typeof useSessionWriter>;

interface DOMStorageId {
  securityOrigin?: string;
  isLocalStorage?: boolean;
}

interface DOMStorageChangeParams {
  storageId?: DOMStorageId;
}

interface LocalStorageSnapshot {
  origin: string;
  entries: Array<{ key: string; value: string }>;
  reason: "initial" | "change" | "final";
}

export function useLocalStorageRecorder(client: CDPClient, writer: SessionWriter) {
  const domain = new LocalStorageDomain(client);
  const snapshots = new Map<string, Array<{ key: string; value: string }>>();
  const disposers: Array<() => void> = [];
  let active = false;

  function isLocalStorageEvent(params: DOMStorageChangeParams): params is {
    storageId: { securityOrigin: string; isLocalStorage: true };
  } {
    return !!params.storageId?.isLocalStorage && !!params.storageId.securityOrigin;
  }

  function writeSnapshot(snapshot: LocalStorageSnapshot) {
    snapshots.set(snapshot.origin, snapshot.entries);
    writer.push("databases", {
      kind: "localStorage",
      origin: snapshot.origin,
      entries: snapshot.entries,
      reason: snapshot.reason,
    });
  }

  async function captureOrigin(origin: string, reason: LocalStorageSnapshot["reason"]) {
    try {
      const entries = await domain.getEntries(origin);
      writeSnapshot({ origin, entries, reason });
    } catch (err) {
      console.warn("[localstorage-recorder] capture failed", origin, err);
    }
  }

  async function captureAll(reason: LocalStorageSnapshot["reason"]) {
    const origins = await domain.getOrigins();
    await Promise.allSettled(origins.map((origin) => captureOrigin(origin, reason)));
  }

  async function handleChange(params: unknown) {
    const event = params as DOMStorageChangeParams;
    if (!active || !isLocalStorageEvent(event)) return;
    try {
      await captureOrigin(event.storageId.securityOrigin, "change");
    } catch (err) {
      console.warn("[localstorage-recorder] change failed", err);
    }
  }

  async function start() {
    active = true;
    await domain.enable();
    await captureAll("initial");
    disposers.push(
      client.on("DOMStorage.domStorageItemAdded", (params) => void handleChange(params)),
      client.on("DOMStorage.domStorageItemUpdated", (params) => void handleChange(params)),
      client.on("DOMStorage.domStorageItemRemoved", (params) => void handleChange(params)),
      client.on("DOMStorage.domStorageItemsCleared", (params) => void handleChange(params)),
    );
  }

  async function stop() {
    active = false;
    for (const dispose of disposers.splice(0)) dispose();
    await captureAll("final");
  }

  return { start, stop, snapshots };
}
