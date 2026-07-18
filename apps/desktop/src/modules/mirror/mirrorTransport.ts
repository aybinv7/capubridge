import type { Channel } from "@tauri-apps/api/core";
import type { ComputedRef } from "vue";
import { invokeCommand } from "@/runtime/ipc";
import type { CDPTarget } from "@/types/cdp.types";
import type { CDPClient } from "@capubridge/cdp-protocol";
import type {
  AndroidKeyCode,
  ScrcpyFrameEvent,
  ScrcpyStreamSettings,
  TouchAction,
} from "./mirrorTypes";

interface MirrorDecoderTransport {
  waitForCanvas: (timeoutMs: number) => Promise<HTMLCanvasElement | null>;
  queueChromeFrame: (
    data: string,
    metadata: { deviceWidth: number; deviceHeight: number },
    sessionId: number,
  ) => void;
  parseMetadata: (metadata: { deviceWidth?: unknown; deviceHeight?: unknown }) => {
    deviceWidth: number;
    deviceHeight: number;
  };
}

interface ChromeTransportOptions {
  activeClient: ComputedRef<CDPClient | null>;
  activeTargetId: () => string | null;
  connectToTarget: (target: CDPTarget) => Promise<CDPClient>;
  resolveTarget: () => CDPTarget | null;
  getChromePort: () => number | null;
  getViewportMode: () => "phone" | "desktop";
  getFps: () => number;
  getMaxSize: () => number;
  isSessionCurrent: (sessionId: number) => boolean;
  isStreaming: () => boolean;
  setDeviceSize: (width: number, height: number) => void;
  markConnected: () => void;
  clearStartupTimeout: () => void;
  scheduleStartupTimeout: (operation: () => void, delay: number) => void;
  onFailure: (reason: string, sessionId: number) => Promise<void>;
  decoder: MirrorDecoderTransport;
}

export function createAdbMirrorTransport() {
  return {
    start(serial: string, settings: ScrcpyStreamSettings, onFrame: Channel<ScrcpyFrameEvent>) {
      return invokeCommand("adb_mirror_scrcpy_start", { serial, settings, onFrame });
    },
    screenshot(serial: string) {
      return invokeCommand("adb_mirror_screenshot", { serial });
    },
    keyEvent(serial: string, keycode: AndroidKeyCode) {
      return invokeCommand("adb_mirror_keyevent", { serial, keycode });
    },
    injectKeycode(serial: string, action: number, keycode: AndroidKeyCode, metaState: number) {
      return invokeCommand("adb_mirror_inject_keycode", {
        serial,
        action,
        keycode,
        repeat: 0,
        metaState,
      });
    },
    injectText(serial: string, text: string) {
      return invokeCommand("adb_mirror_inject_text", { serial, text });
    },
    touch(serial: string, action: TouchAction, x: number, y: number) {
      return invokeCommand("adb_mirror_touch_event", { serial, action, x, y });
    },
    scroll(serial: string, x: number, y: number, hScroll: number, vScroll: number) {
      return invokeCommand("adb_mirror_scroll_event", { serial, x, y, hScroll, vScroll });
    },
    setClipboard(serial: string, text: string) {
      return invokeCommand("adb_mirror_set_clipboard", { serial, text, paste: true });
    },
    getClipboard(serial: string, copyKey: number) {
      return invokeCommand("adb_mirror_get_clipboard", { serial, copyKey });
    },
    startRecording(serial: string) {
      return invokeCommand("adb_mirror_start_recording", { serial });
    },
    stopRecording(serial: string, savePath: string) {
      return invokeCommand("adb_mirror_stop_recording", { serial, savePath });
    },
    launchExternal(serial: string, maxSize: number, bitRateMbps: number, maxFps: number) {
      return invokeCommand("adb_mirror_launch_scrcpy", {
        serial,
        maxSize,
        bitRateMbps,
        maxFps,
      });
    },
  };
}

export function createChromeMirrorTransport(options: ChromeTransportOptions) {
  let client: CDPClient | null = null;
  let frameCleanup: (() => void) | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let didWarnAckFailure = false;
  let didWarnPollingFailure = false;

  function cleanupListeners() {
    frameCleanup?.();
    frameCleanup = null;
    client = null;
  }

  function cleanupPolling() {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  function cleanup() {
    cleanupPolling();
    cleanupListeners();
  }

  async function stopScreencast() {
    if (!client) return;
    try {
      await client.send("Page.stopScreencast");
    } catch (cause) {
      console.warn("Failed to stop Chrome screencast during cleanup", cause);
    }
  }

  async function ensureClient(target: CDPTarget): Promise<CDPClient> {
    const active = options.activeClient.value;
    if (active && options.activeTargetId() === target.id) return active;
    return options.connectToTarget(target);
  }

  async function getPreferredClient() {
    if (client) return client;
    const target = options.resolveTarget();
    if (!target) return null;
    client = await ensureClient(target);
    return client;
  }

  async function activate(target: CDPTarget) {
    const port = options.getChromePort();
    if (port === null) return;
    try {
      await invokeCommand("chrome_activate_target", { port, targetId: target.id });
    } catch (cause) {
      console.warn("Failed to activate mirrored Chrome target", target.id, cause);
    }
  }

  async function activatePreferredTarget() {
    const target = options.resolveTarget();
    if (target) await activate(target);
  }

  async function runBestEffort(name: string, operation: () => Promise<unknown>) {
    try {
      await operation();
    } catch (cause) {
      console.warn(`Chrome mirror operation failed: ${name}`, cause);
    }
  }

  async function readViewport(activeClient: CDPClient) {
    try {
      const result = await activeClient.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
        expression: `(() => ({ width: window.innerWidth, height: window.innerHeight }))()`,
        returnByValue: true,
      });
      const value = result.result.value as Record<string, unknown> | undefined;
      const width = Number(value?.["width"]);
      const height = Number(value?.["height"]);
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        options.setDeviceSize(width, height);
      }
    } catch (cause) {
      console.warn("Failed to read mirrored Chrome viewport", cause);
    }
  }

  async function applyEmulation(activeClient: CDPClient) {
    if (options.getViewportMode() === "phone") {
      await runBestEffort("set device metrics", () =>
        activeClient.send("Emulation.setDeviceMetricsOverride", {
          width: 390,
          height: 844,
          deviceScaleFactor: 2.75,
          mobile: true,
        }),
      );
      await runBestEffort("enable touch emulation", () =>
        activeClient.send("Emulation.setTouchEmulationEnabled", {
          enabled: true,
          maxTouchPoints: 1,
        }),
      );
      await runBestEffort("enable touch events", () =>
        activeClient.send("Emulation.setEmitTouchEventsForMouse", {
          enabled: true,
          configuration: "mobile",
        }),
      );
    } else {
      await runBestEffort("clear device metrics", () =>
        activeClient.send("Emulation.clearDeviceMetricsOverride"),
      );
      await runBestEffort("disable touch emulation", () =>
        activeClient.send("Emulation.setTouchEmulationEnabled", {
          enabled: false,
          maxTouchPoints: 0,
        }),
      );
      await runBestEffort("disable touch events", () =>
        activeClient.send("Emulation.setEmitTouchEventsForMouse", {
          enabled: false,
          configuration: "desktop",
        }),
      );
    }
    await readViewport(activeClient);
  }

  async function applyViewportMode() {
    if (!options.isStreaming()) return;
    const activeClient = await getPreferredClient();
    if (activeClient) await applyEmulation(activeClient);
  }

  async function start(target: CDPTarget, sessionId: number) {
    try {
      await options.decoder.waitForCanvas(650);
      const activeClient = await ensureClient(target);
      if (!options.isSessionCurrent(sessionId)) return;
      await activate(target);
      client = activeClient;
      await activeClient.send("Page.enable");
      await applyEmulation(activeClient);
      let firstFrameSeen = false;
      let wakeAttempted = false;
      frameCleanup = activeClient.on("Page.screencastFrame", (params: unknown) => {
        if (!options.isSessionCurrent(sessionId)) return;
        const payload = params as {
          data?: unknown;
          metadata?: { deviceWidth?: unknown; deviceHeight?: unknown };
          sessionId?: unknown;
        };
        const frameSession = Number(payload.sessionId);
        const data = typeof payload.data === "string" ? payload.data : null;
        if (Number.isFinite(frameSession) && frameSession >= 0) {
          void activeClient
            .send("Page.screencastFrameAck", { sessionId: frameSession })
            .catch((cause) => {
              if (didWarnAckFailure) return;
              didWarnAckFailure = true;
              console.warn("Failed to acknowledge Chrome screencast frame", cause);
            });
        }
        if (!data) return;
        if (!firstFrameSeen) {
          firstFrameSeen = true;
          options.clearStartupTimeout();
        }
        options.decoder.queueChromeFrame(
          data,
          options.decoder.parseMetadata(payload.metadata ?? {}),
          sessionId,
        );
      });
      await activeClient.send("Page.startScreencast", {
        format: "jpeg",
        quality: 80,
        maxWidth: options.getMaxSize(),
        maxHeight: options.getMaxSize(),
        everyNthFrame: Math.max(1, Math.round(60 / Math.max(1, options.getFps()))),
      });
      if (!options.isSessionCurrent(sessionId)) return;
      options.markConnected();
      options.scheduleStartupTimeout(() => {
        if (!options.isSessionCurrent(sessionId) || firstFrameSeen) return;
        if (!wakeAttempted) {
          wakeAttempted = true;
          void activate(target);
          options.scheduleStartupTimeout(() => {
            if (!options.isSessionCurrent(sessionId) || firstFrameSeen) return;
            void startPollingFallback(target, sessionId, "no frames from screencast");
          }, 1200);
          return;
        }
        void startPollingFallback(target, sessionId, "no frames from screencast");
      }, 1400);
    } catch (cause) {
      if (options.isSessionCurrent(sessionId)) {
        await startPollingFallback(target, sessionId, cause);
      }
    }
  }

  async function startPollingFallback(target: CDPTarget, sessionId: number, startError: unknown) {
    try {
      cleanupPolling();
      await stopScreencast();
      cleanupListeners();
      await options.decoder.waitForCanvas(650);
      const activeClient = await ensureClient(target);
      if (!options.isSessionCurrent(sessionId)) return;
      await activate(target);
      client = activeClient;
      await activeClient.send("Page.enable");
      await applyEmulation(activeClient);
      let firstFrameSeen = false;
      const intervalMs = Math.max(50, Math.round(1000 / Math.max(1, options.getFps())));
      pollTimer = setInterval(() => {
        if (!options.isSessionCurrent(sessionId) || !client) return;
        void client
          .send<{ data?: unknown }>("Page.captureScreenshot", {
            format: "jpeg",
            quality: 78,
            fromSurface: true,
          })
          .then((result) => {
            if (!options.isSessionCurrent(sessionId)) return;
            const data = typeof result.data === "string" ? result.data : null;
            if (!data) return;
            if (!firstFrameSeen) {
              firstFrameSeen = true;
              options.clearStartupTimeout();
            }
            options.decoder.queueChromeFrame(data, options.decoder.parseMetadata({}), sessionId);
          })
          .catch((cause) => {
            if (didWarnPollingFailure) return;
            didWarnPollingFailure = true;
            console.warn("Chrome mirror screenshot polling failed", cause);
          });
      }, intervalMs);
      options.markConnected();
      options.scheduleStartupTimeout(() => {
        void options.onFailure("startup timeout waiting for fallback screenshot frame", sessionId);
      }, 2600);
    } catch (cause) {
      if (!options.isSessionCurrent(sessionId)) return;
      await options.onFailure(String(cause), sessionId);
      throw new Error(`${String(startError)} | fallback: ${String(cause)}`);
    }
  }

  async function screenshot() {
    const target = options.resolveTarget();
    if (!target) throw new Error("No Chrome target selected");
    const activeClient = await ensureClient(target);
    const result = await activeClient.send<{ data?: unknown }>("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
    });
    const data = typeof result.data === "string" ? result.data : null;
    if (!data) throw new Error("Chrome screenshot returned empty payload");
    return data;
  }

  return {
    start,
    stopScreencast,
    cleanup,
    applyViewportMode,
    screenshot,
    getPreferredClient,
    activatePreferredTarget,
  };
}
