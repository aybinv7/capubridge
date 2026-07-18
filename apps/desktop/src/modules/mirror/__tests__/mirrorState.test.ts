import { describe, expect, test } from "vite-plus/test";
import { createMirrorStreamState } from "../mirrorState";

describe("mirror stream state", () => {
  test("moves through prepared, selected, connected, and stopped states", () => {
    const store = { isStreaming: true, isRecording: true };
    const state = createMirrorStreamState(store);

    state.prepareStart();
    expect(store.isStreaming).toBe(false);
    expect(state.streamSource.value).toBeNull();

    state.selectSource("adb");
    state.markConnected();
    expect(state.isAndroidStream.value).toBe(true);
    expect(state.isConnected.value).toBe(true);
    expect(store.isStreaming).toBe(true);

    state.markDisconnected({ reason: "disconnected", clearRecording: true });
    expect(state.error.value).toBe("disconnected");
    expect(state.streamSource.value).toBeNull();
    expect(store.isStreaming).toBe(false);
    expect(store.isRecording).toBe(false);
  });

  test("preserves error when disconnect has no reason update", () => {
    const store = { isStreaming: false, isRecording: false };
    const state = createMirrorStreamState(store);
    state.error.value = "existing";

    state.markDisconnected();

    expect(state.error.value).toBe("existing");
  });
});
