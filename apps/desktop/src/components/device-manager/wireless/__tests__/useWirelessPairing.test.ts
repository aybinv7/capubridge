import { effectScope } from "vue";
import { beforeEach, describe, expect, test, vi } from "vite-plus/test";
import type { PairingStateEvent } from "@/types/wireless.types";

const mocks = vi.hoisted(() => ({
  invokeCommand: vi.fn(),
  listenEvent: vi.fn(),
  emit: null as ((event: PairingStateEvent) => void) | null,
  stopListening: vi.fn(),
}));

vi.mock("@/runtime/ipc/client", () => ({
  invokeCommand: mocks.invokeCommand,
  listenEvent: mocks.listenEvent,
}));

const { useWirelessPairing } = await import("../useWirelessPairing");

const QR = { sessionId: 7, serviceName: "studio-AbC", qr: { size: 21, path: "M0 0h1v1h-1z" } };

beforeEach(() => {
  mocks.invokeCommand.mockReset();
  mocks.stopListening.mockReset();
  mocks.listenEvent.mockReset();
  mocks.listenEvent.mockImplementation(
    async (_name: string, handler: (event: PairingStateEvent) => void) => {
      mocks.emit = handler;
      return mocks.stopListening;
    },
  );
});

function setup(onConnected = vi.fn()) {
  const scope = effectScope();
  const pairing = scope.run(() => useWirelessPairing(onConnected));
  if (!pairing) throw new Error("scope did not run");
  return { scope, pairing, onConnected };
}

describe("useWirelessPairing", () => {
  test("a state that arrives before the start reply is not lost", async () => {
    mocks.invokeCommand.mockImplementation(async (command: string) => {
      if (command === "wireless_pairing_start") {
        mocks.emit?.({ sessionId: 7, state: { phase: "waiting" } });
        return QR;
      }
      return undefined;
    });
    const { pairing } = setup();
    expect(await pairing.startQr()).toBe(true);
    expect(pairing.session.value?.qr?.size).toBe(21);
    expect(pairing.state.value).toEqual({ phase: "waiting" });
  });

  test("events of other sessions are ignored and connected is reported once", async () => {
    mocks.invokeCommand.mockResolvedValue(QR);
    const { pairing, onConnected } = setup();
    await pairing.startQr();
    mocks.emit?.({ sessionId: 3, state: { phase: "pairing" } });
    expect(pairing.state.value).toBeNull();
    mocks.emit?.({ sessionId: 7, state: { phase: "connected", serial: "s", guid: "g" } });
    expect(onConnected).toHaveBeenCalledWith("s", "g");
    expect(onConnected).toHaveBeenCalledTimes(1);
  });

  test("disposing the scope cancels the session and stops listening", async () => {
    mocks.invokeCommand.mockResolvedValue(QR);
    const { pairing, scope } = setup();
    await pairing.startQr();
    scope.stop();
    expect(mocks.stopListening).toHaveBeenCalled();
    expect(mocks.invokeCommand).toHaveBeenCalledWith("wireless_pairing_cancel", { sessionId: 7 });
  });

  test("a failed start is reported, not thrown", async () => {
    mocks.invokeCommand.mockRejectedValue(new Error("no entropy"));
    const { pairing } = setup();
    expect(await pairing.startQr()).toBe(false);
    expect(pairing.startError.value).toContain("no entropy");
  });
});
