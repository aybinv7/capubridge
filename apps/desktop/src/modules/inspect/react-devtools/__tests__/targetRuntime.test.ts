import { describe, test, expect } from "vite-plus/test";
import {
  TARGET_BINDING_NAME,
  TARGET_INSTALLED_FLAG,
  TARGET_RECEIVE_NAME,
  buildTargetRuntimeSource,
} from "../targetRuntime";

describe("buildTargetRuntimeSource", () => {
  const source = buildTargetRuntimeSource();

  test("ships the prebuilt backend bundle", () => {
    // No regex patching needed here, unlike the Vue runtime: the bundle is UMD
    // and exposes its entry points on the global already.
    expect(source.length).toBeGreaterThan(500_000);
    expect(source).toContain("ReactDevToolsBackend");
  });

  test("installs the hook before connecting, since react-dom reads it once at load", () => {
    const initialize = source.indexOf("backend.initialize()");
    const connect = source.indexOf("backend.connectToDevTools(");
    expect(initialize).toBeGreaterThan(-1);
    expect(connect).toBeGreaterThan(-1);
    expect(initialize).toBeLessThan(connect);
  });

  test("hands connectToDevTools a socket instead of a host/port", () => {
    // A real ws:// from the device is impossible: Android blocks cleartext
    // loopback with ERR_CLEARTEXT_NOT_PERMITTED even through adb reverse.
    expect(source).toContain("websocket: socket");
    expect(source).not.toContain("port: 8097");
  });

  test("routes the socket over the CDP channel names", () => {
    expect(source).toContain(TARGET_BINDING_NAME);
    expect(source).toContain(TARGET_RECEIVE_NAME);
  });

  test("is idempotent so re-injection cannot stack a second backend", () => {
    const guard = source.indexOf(`if (g[installed])`);
    const connect = source.indexOf("backend.connectToDevTools(");
    expect(source).toContain(TARGET_INSTALLED_FLAG);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(connect);
  });

  test("still reports readiness when re-injected into an installed page", () => {
    // The early return must announce readiness or the host handshake stalls.
    const guardBlock = source.slice(
      source.indexOf(`if (g[installed])`),
      source.indexOf("var backend = g.ReactDevToolsBackend"),
    );
    expect(guardBlock).toContain("notify(");
    expect(guardBlock).toContain("return");
  });
});
