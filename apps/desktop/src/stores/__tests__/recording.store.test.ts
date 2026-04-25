import { describe, test, expect, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import { useRecordingStore } from "../recording.store";

describe("recording store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test("initial state is idle", () => {
    const store = useRecordingStore();
    expect(store.phase).toBe("idle");
    expect(store.isRecording).toBe(false);
    expect(store.sessionId).toBeNull();
  });

  test("setPhase transitions state", () => {
    const store = useRecordingStore();
    store.setPhase("recording", "session-123");
    expect(store.phase).toBe("recording");
    expect(store.sessionId).toBe("session-123");
    expect(store.isRecording).toBe(true);
  });

  test("reset returns to idle", () => {
    const store = useRecordingStore();
    store.setPhase("recording", "session-123");
    store.reset();
    expect(store.phase).toBe("idle");
    expect(store.sessionId).toBeNull();
    expect(store.startedAt).toBeNull();
  });

  test("isRecording computed is true only during recording phase", () => {
    const store = useRecordingStore();
    store.setPhase("configuring");
    expect(store.isRecording).toBe(false);
    store.setPhase("recording", "abc");
    expect(store.isRecording).toBe(true);
    store.setPhase("stopping");
    expect(store.isRecording).toBe(false);
  });

  test("startedAt is set on first transition to recording", () => {
    const store = useRecordingStore();
    expect(store.startedAt).toBeNull();
    store.setPhase("recording", "abc");
    expect(store.startedAt).toBeGreaterThan(0);
    // Subsequent setPhase calls do not reset startedAt
    const t = store.startedAt;
    store.setPhase("stopping");
    expect(store.startedAt).toBe(t);
  });
});
