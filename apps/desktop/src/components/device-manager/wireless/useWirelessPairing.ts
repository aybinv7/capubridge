import { computed, onScopeDispose, shallowRef } from "vue";
import { invokeCommand, listenEvent } from "@/runtime/ipc/client";
import type { PairingPhase, PairingStateEvent, QrMatrix } from "@/types/wireless.types";

export type PairingMode = "qr" | "code";

interface PairingSession {
  id: number;
  mode: PairingMode;
  qr: QrMatrix | null;
}

/**
 * One pairing session at a time (QR or code), driven by the backend: this tracks its id, the
 * QR code to draw and the latest state it streams. The session is cancelled when the panel
 * goes away or another one starts.
 */
export function useWirelessPairing(onConnected: (serial: string, guid: string | null) => void) {
  const session = shallowRef<PairingSession | null>(null);
  const state = shallowRef<PairingPhase | null>(null);
  const starting = shallowRef(false);
  const startError = shallowRef<string | null>(null);
  const early = new Map<number, PairingPhase>();
  let unlisten: (() => void) | null = null;
  let listening: Promise<void> | null = null;
  let disposed = false;

  const busy = computed(
    () => starting.value || state.value?.phase === "pairing" || state.value?.phase === "connecting",
  );

  function apply(event: PairingStateEvent) {
    const current = session.value?.id ?? null;
    if (current !== event.sessionId) {
      if (current === null || event.sessionId > current) early.set(event.sessionId, event.state);
      return;
    }
    state.value = event.state;
    if (event.state.phase === "connected") onConnected(event.state.serial, event.state.guid);
  }

  function ensureListener(): Promise<void> {
    listening ??= listenEvent("capubridge:wireless-pairing", apply).then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    });
    return listening;
  }

  function adopt(next: PairingSession) {
    session.value = next;
    const buffered = early.get(next.id);
    early.clear();
    state.value = null;
    if (buffered) apply({ sessionId: next.id, state: buffered });
  }

  async function cancel() {
    const current = session.value;
    session.value = null;
    state.value = null;
    if (!current) return;
    try {
      await invokeCommand("wireless_pairing_cancel", { sessionId: current.id });
    } catch (error) {
      console.warn("Could not cancel the pairing session", error);
    }
  }

  async function begin(start: () => Promise<PairingSession>): Promise<boolean> {
    if (starting.value) return false;
    starting.value = true;
    startError.value = null;
    try {
      await ensureListener();
      await cancel();
      const next = await start();
      if (disposed) {
        await invokeCommand("wireless_pairing_cancel", { sessionId: next.id });
        return false;
      }
      adopt(next);
      return true;
    } catch (error) {
      startError.value = String(error);
      return false;
    } finally {
      starting.value = false;
    }
  }

  function startQr() {
    return begin(async () => {
      const started = await invokeCommand("wireless_pairing_start");
      return { id: started.sessionId, mode: "qr", qr: started.qr };
    });
  }

  function startCode(host: string, port: number, code: string) {
    return begin(async () => {
      const id = await invokeCommand("wireless_pairing_with_code", { host, port, code });
      return { id, mode: "code", qr: null };
    });
  }

  onScopeDispose(() => {
    disposed = true;
    unlisten?.();
    unlisten = null;
    void cancel();
  });

  return { session, state, starting, startError, busy, startQr, startCode, cancel };
}
