import { computed, onUnmounted, ref } from "vue";
import { Channel, invoke } from "@tauri-apps/api/core";
import { toast } from "vue-sonner";
import { useCDP } from "@/composables/useCDP";
import { runSessionEffect, startMirrorLeaseEffect, stopMirrorLeaseEffect } from "@/runtime/session";
import { useDevicesStore } from "@/stores/devices.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useSourceStore } from "@/stores/source.store";
import type { CDPTarget } from "@/types/cdp.types";
import type { CDPClient } from "utils";

export const AndroidKey = {
  HOME: 3,
  BACK: 4,
  DPAD_UP: 19,
  DPAD_DOWN: 20,
  DPAD_LEFT: 21,
  DPAD_RIGHT: 22,
  A: 29,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  POWER: 26,
  TAB: 61,
  ENTER: 66,
  DEL: 67,
  FORWARD_DEL: 112,
  PAGE_UP: 92,
  PAGE_DOWN: 93,
  MOVE_HOME: 122,
  MOVE_END: 123,
  WAKEUP: 224,
  SLEEP: 223,
  RECENTS: 187,
} as const;

export type AndroidKeyCode = (typeof AndroidKey)[keyof typeof AndroidKey];

interface ScrcpyStreamSettings {
  maxSize: number;
  maxFps: number;
  videoBitRate: number;
  videoCodec: "h264" | "h265";
}

interface ScrcpyConfigEvent {
  event: "config";
  data: { codec: string; description: string };
}

interface ScrcpyPacketEvent {
  event: "packet";
  data: { key: boolean; data: string; timestamp: number };
}

interface ScrcpyDisconnectedEvent {
  event: "disconnected";
  data: { reason: string };
}

type ScrcpyFrameEvent = ScrcpyConfigEvent | ScrcpyPacketEvent | ScrcpyDisconnectedEvent;
type TouchAction = "down" | "move" | "up";

interface TouchEventRequest {
  action: TouchAction;
  x: number;
  y: number;
  enqueuedAt: number;
}

interface MirrorKeyboardEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

interface MirrorClipboardPayload {
  serial: string;
  text: string;
}

interface ScreencastFrameMetadata {
  deviceWidth: number;
  deviceHeight: number;
}

interface RawScreencastFrameEvent {
  data?: unknown;
  metadata?: {
    deviceWidth?: unknown;
    deviceHeight?: unknown;
  };
  sessionId?: unknown;
}

export function useMirrorStream() {
  const mirrorStore = useMirrorStore();
  const devicesStore = useDevicesStore();
  const sourceStore = useSourceStore();
  const { activeClient, connectToTarget, targetsStore, connectionStore } = useCDP();

  const useScrcpyCanvas = ref(false);
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  const canvasElement = ref<HTMLCanvasElement | null>(null);
  const streamSource = ref<"adb" | "chrome" | null>(null);
  const isAndroidStream = computed(() => streamSource.value === "adb");

  let decoder: VideoDecoder | null = null;
  let pendingVideoFrame: VideoFrame | null = null;
  let drawScheduled = false;
  let startupTimeout: ReturnType<typeof setTimeout> | null = null;
  let sessionId = 0;
  let touchQueue: TouchEventRequest[] = [];
  let touchProcessing = false;
  let touchStatsWindowStartedAt = 0;
  let touchSent = 0;
  let touchCoalesced = 0;
  let touchInvokeMsTotal = 0;
  let touchQueueDelayMsTotal = 0;
  let chromeClient: CDPClient | null = null;
  let chromeFrameCleanup: (() => void) | null = null;
  let pendingChromeFrame: { data: string; metadata: ScreencastFrameMetadata } | null = null;
  let chromeDrawInFlight = false;
  let pointerDown = false;
  let chromePollTimer: ReturnType<typeof setInterval> | null = null;
  let adbLeaseSerial: string | null = null;
  let streamRunId = 0;
  let clipboardUnlisten: (() => void) | null = null;
  let lastDeviceClipboardText = "";

  const ANDROID_KEY_ACTION_DOWN = 0;
  const ANDROID_KEY_ACTION_UP = 1;
  const ANDROID_META_SHIFT_ON = 1;
  const ANDROID_META_ALT_ON = 2;
  const ANDROID_META_CTRL_ON = 4096;
  const ANDROID_META_META_ON = 65536;
  const SCRCPY_COPY_KEY_COPY = 1;
  const SCRCPY_COPY_KEY_CUT = 2;

  async function beginMirrorLease(serial: string) {
    await runSessionEffect(startMirrorLeaseEffect(serial), {
      operation: "session.startMirrorLease",
    });
    adbLeaseSerial = serial;
  }

  async function endMirrorLease(serial: string) {
    try {
      await runSessionEffect(stopMirrorLeaseEffect(serial), {
        operation: "session.stopMirrorLease",
      });
    } catch {}
    if (adbLeaseSerial === serial) {
      adbLeaseSerial = null;
    }
  }

  function b64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
    const buffer = new Uint8Array(bytes.byteLength);
    buffer.set(bytes);
    return buffer.buffer;
  }

  function clearStartupTimeout() {
    if (!startupTimeout) return;
    clearTimeout(startupTimeout);
    startupTimeout = null;
  }

  function resetTouchStats() {
    touchStatsWindowStartedAt = performance.now();
    touchSent = 0;
    touchCoalesced = 0;
    touchInvokeMsTotal = 0;
    touchQueueDelayMsTotal = 0;
  }

  function cleanupScrcpyDecoder() {
    clearStartupTimeout();
    if (pendingVideoFrame) {
      pendingVideoFrame.close();
      pendingVideoFrame = null;
    }
    drawScheduled = false;
    if (decoder && decoder.state !== "closed") {
      decoder.close();
    }
    decoder = null;
  }

  function cleanupChromeFrameQueue() {
    pendingChromeFrame = null;
    chromeDrawInFlight = false;
  }

  function cleanupChromeListeners() {
    if (chromeFrameCleanup) {
      chromeFrameCleanup();
      chromeFrameCleanup = null;
    }
    chromeClient = null;
  }

  function cleanupChromePolling() {
    if (!chromePollTimer) return;
    clearInterval(chromePollTimer);
    chromePollTimer = null;
  }

  function getAndroidMetaState(event: MirrorKeyboardEvent) {
    let metaState = 0;
    if (event.shiftKey) metaState |= ANDROID_META_SHIFT_ON;
    if (event.altKey) metaState |= ANDROID_META_ALT_ON;
    if (event.ctrlKey) metaState |= ANDROID_META_CTRL_ON;
    if (event.metaKey) metaState |= ANDROID_META_META_ON;
    return metaState;
  }

  function resolveSpecialAndroidKey(event: MirrorKeyboardEvent): AndroidKeyCode | null {
    const keyMap: Record<string, AndroidKeyCode> = {
      Enter: AndroidKey.ENTER,
      Backspace: AndroidKey.DEL,
      Delete: AndroidKey.FORWARD_DEL,
      Tab: AndroidKey.TAB,
      Escape: AndroidKey.BACK,
      ArrowUp: AndroidKey.DPAD_UP,
      ArrowDown: AndroidKey.DPAD_DOWN,
      ArrowLeft: AndroidKey.DPAD_LEFT,
      ArrowRight: AndroidKey.DPAD_RIGHT,
      PageUp: AndroidKey.PAGE_UP,
      PageDown: AndroidKey.PAGE_DOWN,
      Home: AndroidKey.MOVE_HOME,
      End: AndroidKey.MOVE_END,
    };
    return keyMap[event.key] ?? null;
  }

  function clampScrollDelta(delta: number) {
    return Math.max(-1, Math.min(1, delta / 120));
  }

  function getWindowsVirtualKeyCode(event: MirrorKeyboardEvent) {
    const keyMap: Record<string, number> = {
      Enter: 13,
      Backspace: 8,
      Delete: 46,
      Tab: 9,
      Escape: 27,
      ArrowUp: 38,
      ArrowDown: 40,
      ArrowLeft: 37,
      ArrowRight: 39,
      PageUp: 33,
      PageDown: 34,
      Home: 36,
      End: 35,
    };
    if (event.key.length === 1) return event.key.toUpperCase().charCodeAt(0);
    return keyMap[event.key] ?? 0;
  }

  function getChromeModifiers(event: MirrorKeyboardEvent) {
    let modifiers = 0;
    if (event.altKey) modifiers |= 1;
    if (event.ctrlKey) modifiers |= 2;
    if (event.metaKey) modifiers |= 4;
    if (event.shiftKey) modifiers |= 8;
    return modifiers;
  }

  async function writeHostClipboardText(text: string) {
    try {
      const clipboard = await import("@tauri-apps/plugin-clipboard-manager");
      await clipboard.writeText(text);
      return;
    } catch {}
    await navigator.clipboard.writeText(text);
  }

  async function readHostClipboardText() {
    try {
      const clipboard = await import("@tauri-apps/plugin-clipboard-manager");
      return await clipboard.readText();
    } catch {}
    return navigator.clipboard.readText();
  }

  async function setupDeviceClipboardListener() {
    if (clipboardUnlisten) return;
    try {
      const { listen } = await import("@tauri-apps/api/event");
      clipboardUnlisten = await listen<MirrorClipboardPayload>(
        "capubridge:mirror-device-clipboard",
        async (event) => {
          const serial = resolveAdbSerial();
          if (!serial || event.payload.serial !== serial) return;
          if (!event.payload.text || event.payload.text === lastDeviceClipboardText) return;
          lastDeviceClipboardText = event.payload.text;
          await writeHostClipboardText(event.payload.text).catch(() => null);
        },
      );
    } catch {}
  }

  function cleanupDeviceClipboardListener() {
    if (!clipboardUnlisten) return;
    clipboardUnlisten();
    clipboardUnlisten = null;
  }

  async function stopChromeScreencast() {
    if (!chromeClient) return;
    try {
      await chromeClient.send("Page.stopScreencast");
    } catch {}
  }

  function drawVideoFrame(frame: VideoFrame) {
    const canvas = canvasElement.value;
    if (!canvas) {
      frame.close();
      return;
    }

    if (canvas.width !== frame.displayWidth || canvas.height !== frame.displayHeight) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      frame.close();
      return;
    }

    ctx.drawImage(frame, 0, 0);
    frame.close();
  }

  function queueVideoFrame(frame: VideoFrame) {
    if (pendingVideoFrame) {
      pendingVideoFrame.close();
    }
    pendingVideoFrame = frame;
    if (drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(() => {
      drawScheduled = false;
      const next = pendingVideoFrame;
      pendingVideoFrame = null;
      if (!next) return;
      drawVideoFrame(next);
    });
  }

  async function drawChromeFrameData(
    data: string,
    metadata: ScreencastFrameMetadata,
    activeSessionId: number,
  ) {
    const canvas = canvasElement.value;
    if (!canvas) return;
    if (activeSessionId !== sessionId) return;

    const frameWidth = Math.max(1, Math.round(metadata.deviceWidth));
    const frameHeight = Math.max(1, Math.round(metadata.deviceHeight));
    if (canvas.width !== frameWidth || canvas.height !== frameHeight) {
      canvas.width = frameWidth;
      canvas.height = frameHeight;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const blob = new Blob([bytesToArrayBuffer(b64ToBytes(data))], { type: "image/jpeg" });

    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(blob);
        if (activeSessionId !== sessionId) {
          bitmap.close();
          return;
        }
        ctx.drawImage(bitmap, 0, 0, frameWidth, frameHeight);
        bitmap.close();
        return;
      } catch {}
    }

    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const nextImage = new Image();
        nextImage.onload = () => resolve(nextImage);
        nextImage.onerror = () => reject(new Error("Failed to decode screencast frame"));
        nextImage.src = url;
      });
      if (activeSessionId !== sessionId) return;
      ctx.drawImage(image, 0, 0, frameWidth, frameHeight);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function pumpChromeFrames(activeSessionId: number) {
    while (activeSessionId === sessionId && pendingChromeFrame) {
      const frame = pendingChromeFrame;
      pendingChromeFrame = null;
      mirrorStore.setDeviceSize(frame.metadata.deviceWidth, frame.metadata.deviceHeight);
      try {
        await drawChromeFrameData(frame.data, frame.metadata, activeSessionId);
      } catch (drawErr) {
        await failChrome(`frame render failed: ${String(drawErr)}`, activeSessionId);
        break;
      }
      clearStartupTimeout();
    }
    chromeDrawInFlight = false;
    if (activeSessionId === sessionId && pendingChromeFrame) {
      chromeDrawInFlight = true;
      void pumpChromeFrames(activeSessionId);
    }
  }

  function queueChromeFrame(
    data: string,
    metadata: ScreencastFrameMetadata,
    activeSessionId: number,
  ) {
    pendingChromeFrame = { data, metadata };
    if (chromeDrawInFlight) return;
    chromeDrawInFlight = true;
    void pumpChromeFrames(activeSessionId);
  }

  function parseScreencastMetadata(
    raw: RawScreencastFrameEvent["metadata"],
  ): ScreencastFrameMetadata {
    const fallbackWidth = mirrorStore.deviceWidth || 1080;
    const fallbackHeight = mirrorStore.deviceHeight || 1920;
    const width = Number(raw?.deviceWidth);
    const height = Number(raw?.deviceHeight);
    return {
      deviceWidth: Number.isFinite(width) && width > 0 ? width : fallbackWidth,
      deviceHeight: Number.isFinite(height) && height > 0 ? height : fallbackHeight,
    };
  }

  function resolvePreferredChromeTarget(): CDPTarget | null {
    const selectedTarget = targetsStore.selectedTarget;
    if (selectedTarget) {
      if (selectedTarget.source !== "chrome") return null;
      if (selectedTarget.type === "page") return selectedTarget;
      return selectedTarget;
    }

    const firstChromePage = targetsStore.targets.find(
      (target) => target.source === "chrome" && target.type === "page",
    );
    if (firstChromePage) return firstChromePage;

    return targetsStore.targets.find((target) => target.source === "chrome") ?? null;
  }

  function resolveAdbSerial(): string | null {
    const selectedDevice = devicesStore.selectedDevice;
    if (selectedDevice?.status === "online") return selectedDevice.serial;

    const target = targetsStore.selectedTarget;
    if (target?.source === "adb" && target.deviceSerial) return target.deviceSerial;
    return null;
  }

  function resolvePreferredSource(): "adb" | "chrome" | null {
    const selectedTarget = targetsStore.selectedTarget;
    const serial = resolveAdbSerial();
    if (serial && (!selectedTarget || selectedTarget.source === "adb")) {
      return "adb";
    }
    if (resolvePreferredChromeTarget()) return "chrome";
    if (serial) return "adb";
    return null;
  }

  function isChromePhoneMode() {
    return mirrorStore.settings.chromeViewportMode === "phone";
  }

  async function ensureChromeClient(target: CDPTarget): Promise<CDPClient> {
    const active = activeClient.value;
    if (active && connectionStore.activeConnection?.targetId === target.id) {
      return active;
    }
    return connectToTarget(target);
  }

  async function waitForCanvas(timeoutMs: number) {
    const startedAt = performance.now();
    while (!canvasElement.value && performance.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    return canvasElement.value;
  }

  async function readChromeViewport(client: CDPClient) {
    try {
      const result = await client.send<{ result: { value?: unknown } }>("Runtime.evaluate", {
        expression: `(() => ({ width: window.innerWidth, height: window.innerHeight }))()`,
        returnByValue: true,
      });
      const value = result.result.value as Record<string, unknown> | undefined;
      const width = Number(value?.["width"]);
      const height = Number(value?.["height"]);
      if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
        mirrorStore.setDeviceSize(width, height);
      }
    } catch {}
  }

  async function applyChromeEmulation(client: CDPClient) {
    if (isChromePhoneMode()) {
      try {
        await client.send("Emulation.setDeviceMetricsOverride", {
          width: 390,
          height: 844,
          deviceScaleFactor: 2.75,
          mobile: true,
        });
      } catch {}
      try {
        await client.send("Emulation.setTouchEmulationEnabled", {
          enabled: true,
          maxTouchPoints: 1,
        });
      } catch {}
      try {
        await client.send("Emulation.setEmitTouchEventsForMouse", {
          enabled: true,
          configuration: "mobile",
        });
      } catch {}
    } else {
      try {
        await client.send("Emulation.clearDeviceMetricsOverride");
      } catch {}
      try {
        await client.send("Emulation.setTouchEmulationEnabled", {
          enabled: false,
          maxTouchPoints: 0,
        });
      } catch {}
      try {
        await client.send("Emulation.setEmitTouchEventsForMouse", {
          enabled: false,
          configuration: "desktop",
        });
      } catch {}
    }
    await readChromeViewport(client);
  }

  async function applyChromeViewportMode() {
    if (streamSource.value !== "chrome") return;
    if (!mirrorStore.isStreaming) return;

    if (!chromeClient) {
      const target = resolvePreferredChromeTarget();
      if (!target) return;
      chromeClient = await ensureChromeClient(target);
    }

    await applyChromeEmulation(chromeClient);
  }

  async function activateChromeTarget(target: CDPTarget) {
    const source = sourceStore.getChromeSource();
    if (!source) return;
    try {
      await invoke("chrome_activate_target", {
        port: source.port,
        targetId: target.id,
      });
    } catch {}
  }

  function setCanvasElement(el: HTMLCanvasElement | null) {
    canvasElement.value = el;
  }

  async function failScrcpy(serial: string, reason: string, id: number) {
    if (id !== sessionId) return;
    clearStartupTimeout();
    await endMirrorLease(serial);
    cleanupScrcpyDecoder();
    cleanupChromeFrameQueue();
    cleanupChromePolling();
    cleanupChromeListeners();
    touchQueue = [];
    touchProcessing = false;
    pointerDown = false;
    streamSource.value = null;
    useScrcpyCanvas.value = false;
    isConnected.value = false;
    mirrorStore.isStreaming = false;
    error.value = reason;
  }

  async function startAdbStream(serial: string, activeSessionId: number) {
    const canUseWebCodecs =
      typeof window !== "undefined" &&
      typeof VideoDecoder !== "undefined" &&
      typeof EncodedVideoChunk !== "undefined";
    if (!canUseWebCodecs) {
      const msg = "WebCodecs is not available on this platform.";
      await endMirrorLease(serial);
      error.value = msg;
      toast.error("Mirror unavailable", { description: msg });
      return;
    }

    let firstFrameSeen = false;
    const channel = new Channel<ScrcpyFrameEvent>();
    channel.onmessage = (msg) => {
      if (activeSessionId !== sessionId) return;

      if (msg.event === "config") {
        cleanupScrcpyDecoder();

        const description = b64ToBytes(msg.data.description);
        const nextDecoder = new VideoDecoder({
          output: (frame) => {
            if (!firstFrameSeen) {
              firstFrameSeen = true;
              clearStartupTimeout();
            }
            queueVideoFrame(frame);
          },
          error: (decodeErr) => {
            void failScrcpy(serial, `decoder error: ${String(decodeErr)}`, activeSessionId);
          },
        });

        const config: VideoDecoderConfig = {
          codec: msg.data.codec,
          description: description.buffer,
          hardwareAcceleration: "prefer-hardware",
        };
        void VideoDecoder.isConfigSupported(config)
          .then((result) => {
            if (activeSessionId !== sessionId) {
              nextDecoder.close();
              return;
            }
            if (!result.supported) {
              nextDecoder.close();
              void failScrcpy(serial, `codec not supported: ${msg.data.codec}`, activeSessionId);
              return;
            }
            nextDecoder.configure(config);
            decoder = nextDecoder;
          })
          .catch((configErr) => {
            nextDecoder.close();
            void failScrcpy(serial, `config check failed: ${String(configErr)}`, activeSessionId);
          });
        return;
      }

      if (msg.event === "packet") {
        if (!decoder || decoder.state !== "configured") return;
        try {
          const chunk = new EncodedVideoChunk({
            type: msg.data.key ? "key" : "delta",
            timestamp: msg.data.timestamp,
            data: b64ToBytes(msg.data.data),
          });
          decoder.decode(chunk);
        } catch (decodeErr) {
          void failScrcpy(serial, `packet decode failed: ${String(decodeErr)}`, activeSessionId);
        }
        return;
      }

      clearStartupTimeout();
      cleanupScrcpyDecoder();
      useScrcpyCanvas.value = false;
      isConnected.value = false;
      mirrorStore.isStreaming = false;
      if (msg.data.reason !== "stopped") {
        error.value = msg.data.reason || "scrcpy stream disconnected";
      }
    };

    try {
      await waitForCanvas(1000);
      if (activeSessionId !== sessionId) return;

      const streamSettings: ScrcpyStreamSettings = {
        maxSize: mirrorStore.settings.recordQuality === "720p" ? 1280 : 1920,
        maxFps: Math.max(30, mirrorStore.settings.fps),
        videoBitRate: mirrorStore.settings.recordBitrate * 1_000_000,
        videoCodec: "h264",
      };
      const [width, height] = await invoke<[number, number]>("adb_mirror_scrcpy_start", {
        serial,
        settings: streamSettings,
        onFrame: channel,
      });

      if (activeSessionId !== sessionId) return;

      mirrorStore.setDeviceSize(width, height);
      await setupDeviceClipboardListener();
      useScrcpyCanvas.value = true;
      isConnected.value = true;
      mirrorStore.isStreaming = true;

      startupTimeout = setTimeout(() => {
        if (!firstFrameSeen) {
          void failScrcpy(
            serial,
            "startup timeout waiting for first decoded frame",
            activeSessionId,
          );
        }
      }, 5000);
    } catch (startErr) {
      if (activeSessionId !== sessionId) return;
      await endMirrorLease(serial);
      error.value = String(startErr);
      toast.error("Mirror failed to start", { description: String(startErr) });
    }
  }

  async function failChrome(reason: string, activeSessionId: number) {
    if (activeSessionId !== sessionId) return;
    clearStartupTimeout();
    await stopChromeScreencast();
    cleanupChromeListeners();
    cleanupChromeFrameQueue();
    cleanupChromePolling();
    touchQueue = [];
    touchProcessing = false;
    pointerDown = false;
    streamSource.value = null;
    useScrcpyCanvas.value = false;
    isConnected.value = false;
    mirrorStore.isStreaming = false;
    error.value = reason;
  }

  async function startChromeStream(target: CDPTarget, activeSessionId: number) {
    try {
      await waitForCanvas(650);
      const client = await ensureChromeClient(target);
      if (activeSessionId !== sessionId) return;

      await activateChromeTarget(target);

      chromeClient = client;
      await client.send("Page.enable");
      await applyChromeEmulation(client);

      let firstFrameSeen = false;
      let wakeAttempted = false;

      const cleanupFrame = client.on("Page.screencastFrame", (params: unknown) => {
        if (activeSessionId !== sessionId) return;
        const payload = params as RawScreencastFrameEvent;
        const session = Number(payload.sessionId);
        const data = typeof payload.data === "string" ? payload.data : null;
        if (Number.isFinite(session) && session >= 0) {
          void client.send("Page.screencastFrameAck", { sessionId: session }).catch(() => {});
        }
        if (!data) return;
        if (!firstFrameSeen) {
          firstFrameSeen = true;
          clearStartupTimeout();
        }
        queueChromeFrame(data, parseScreencastMetadata(payload.metadata), activeSessionId);
      });

      chromeFrameCleanup = cleanupFrame;

      const maxSize = mirrorStore.settings.recordQuality === "720p" ? 1280 : 1920;
      const everyNthFrame = Math.max(1, Math.round(60 / Math.max(1, mirrorStore.settings.fps)));

      await client.send("Page.startScreencast", {
        format: "jpeg",
        quality: 80,
        maxWidth: maxSize,
        maxHeight: maxSize,
        everyNthFrame,
      });

      if (activeSessionId !== sessionId) return;

      useScrcpyCanvas.value = true;
      isConnected.value = true;
      mirrorStore.isStreaming = true;

      startupTimeout = setTimeout(() => {
        if (activeSessionId !== sessionId || firstFrameSeen) return;
        if (!wakeAttempted) {
          wakeAttempted = true;
          void activateChromeTarget(target);
          startupTimeout = setTimeout(() => {
            if (activeSessionId !== sessionId || firstFrameSeen) return;
            void startChromePollingFallback(target, activeSessionId, "no frames from screencast");
          }, 1200);
          return;
        }
        void startChromePollingFallback(target, activeSessionId, "no frames from screencast");
      }, 1400);
    } catch (startErr) {
      if (activeSessionId !== sessionId) return;
      await startChromePollingFallback(target, activeSessionId, startErr);
    }
  }

  async function startChromePollingFallback(
    target: CDPTarget,
    activeSessionId: number,
    startErr: unknown,
  ) {
    try {
      cleanupChromePolling();
      await stopChromeScreencast();
      cleanupChromeListeners();
      await waitForCanvas(650);
      const client = await ensureChromeClient(target);
      if (activeSessionId !== sessionId) return;
      await activateChromeTarget(target);
      chromeClient = client;
      await client.send("Page.enable");
      await applyChromeEmulation(client);
      const intervalMs = Math.max(50, Math.round(1000 / Math.max(1, mirrorStore.settings.fps)));

      let firstFrameSeen = false;
      chromePollTimer = setInterval(() => {
        if (activeSessionId !== sessionId || !chromeClient) return;
        void chromeClient
          .send<{ data?: unknown }>("Page.captureScreenshot", {
            format: "jpeg",
            quality: 78,
            fromSurface: true,
          })
          .then((result) => {
            if (activeSessionId !== sessionId) return;
            const data = typeof result.data === "string" ? result.data : null;
            if (!data) return;
            const metadata: ScreencastFrameMetadata = {
              deviceWidth: mirrorStore.deviceWidth || 1080,
              deviceHeight: mirrorStore.deviceHeight || 1920,
            };
            if (!firstFrameSeen) {
              firstFrameSeen = true;
              clearStartupTimeout();
            }
            queueChromeFrame(data, metadata, activeSessionId);
          })
          .catch(() => {});
      }, intervalMs);

      useScrcpyCanvas.value = true;
      isConnected.value = true;
      mirrorStore.isStreaming = true;

      startupTimeout = setTimeout(() => {
        void failChrome("startup timeout waiting for fallback screenshot frame", activeSessionId);
      }, 2600);
    } catch (fallbackErr) {
      if (activeSessionId !== sessionId) return;
      await failChrome(String(fallbackErr), activeSessionId);
      toast.error("Mirror failed to start", {
        description: `${String(startErr)} | fallback: ${String(fallbackErr)}`,
      });
    }
  }

  async function startStream() {
    const runId = ++streamRunId;
    sessionId += 1;
    const activeSessionId = sessionId;

    error.value = null;
    cleanupScrcpyDecoder();
    cleanupChromeFrameQueue();
    cleanupChromePolling();
    cleanupChromeListeners();
    cleanupDeviceClipboardListener();
    touchQueue = [];
    touchProcessing = false;
    pointerDown = false;
    resetTouchStats();
    useScrcpyCanvas.value = false;
    isConnected.value = false;
    mirrorStore.isStreaming = false;
    streamSource.value = null;
    adbLeaseSerial = null;

    const preferredSource = resolvePreferredSource();
    if (runId !== streamRunId || activeSessionId !== sessionId) return;
    if (!preferredSource) {
      const msg = "Select target or online Android device before starting mirror.";
      error.value = msg;
      toast.error("Mirror unavailable", { description: msg });
      return;
    }

    streamSource.value = preferredSource;
    if (preferredSource === "chrome") {
      const target = resolvePreferredChromeTarget();
      if (!target) {
        const msg = "No Chrome target selected for mirror preview.";
        error.value = msg;
        toast.error("Mirror unavailable", { description: msg });
        streamSource.value = null;
        return;
      }
      await startChromeStream(target, activeSessionId);
      return;
    }

    const serial = resolveAdbSerial();
    if (!serial) {
      const msg = "No online Android device selected for mirror.";
      error.value = msg;
      toast.error("Mirror unavailable", { description: msg });
      streamSource.value = null;
      return;
    }
    try {
      await beginMirrorLease(serial);
      if (runId !== streamRunId || activeSessionId !== sessionId) {
        await endMirrorLease(serial);
        return;
      }
    } catch (leaseErr) {
      error.value = String(leaseErr);
      toast.error("Mirror unavailable", { description: String(leaseErr) });
      streamSource.value = null;
      return;
    }
    await startAdbStream(serial, activeSessionId);
  }

  async function stopStream() {
    streamRunId += 1;
    sessionId += 1;
    const source = streamSource.value;

    if (source === "adb") {
      if (adbLeaseSerial) {
        await endMirrorLease(adbLeaseSerial);
      }
    }

    if (source === "chrome") {
      await stopChromeScreencast();
    }

    cleanupScrcpyDecoder();
    cleanupChromePolling();
    cleanupChromeListeners();
    cleanupChromeFrameQueue();
    touchQueue = [];
    touchProcessing = false;
    pointerDown = false;
    useScrcpyCanvas.value = false;
    isConnected.value = false;
    mirrorStore.isStreaming = false;
    mirrorStore.isRecording = false;
    streamSource.value = null;
    error.value = null;
  }

  async function takeScreenshot(): Promise<string> {
    if (streamSource.value === "chrome") {
      const target = resolvePreferredChromeTarget();
      if (!target) throw new Error("No Chrome target selected");
      const client = await ensureChromeClient(target);
      const result = await client.send<{ data?: unknown }>("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
      });
      const data = typeof result.data === "string" ? result.data : null;
      if (!data) throw new Error("Chrome screenshot returned empty payload");
      return data;
    }

    const serial = resolveAdbSerial();
    if (!serial) throw new Error("No Android device selected");
    return invoke<string>("adb_mirror_screenshot", { serial });
  }

  async function downloadScreenshot() {
    try {
      const b64 = await takeScreenshot();
      const a = document.createElement("a");
      a.href = `data:image/png;base64,${b64}`;
      a.download = `screenshot_${Date.now()}.png`;
      a.click();
      toast.success("Screenshot saved");
    } catch (screenshotErr) {
      toast.error("Screenshot failed", { description: String(screenshotErr) });
    }
  }

  async function sendKey(keycode: AndroidKeyCode) {
    if (streamSource.value !== "adb") return;
    const serial = resolveAdbSerial();
    if (!serial) return;
    try {
      await invoke("adb_mirror_keyevent", { serial, keycode });
    } catch (keyErr) {
      toast.error("Key event failed", { description: String(keyErr) });
    }
  }

  async function sendAndroidKeycode(keycode: AndroidKeyCode, metaState = 0) {
    if (streamSource.value !== "adb") return;
    const serial = resolveAdbSerial();
    if (!serial) return;
    await invoke("adb_mirror_inject_keycode", {
      serial,
      action: ANDROID_KEY_ACTION_DOWN,
      keycode,
      repeat: 0,
      metaState,
    });
    await invoke("adb_mirror_inject_keycode", {
      serial,
      action: ANDROID_KEY_ACTION_UP,
      keycode,
      repeat: 0,
      metaState,
    });
  }

  async function dispatchTouch(action: TouchAction, x: number, y: number) {
    if (streamSource.value === "adb") {
      const serial = resolveAdbSerial();
      if (!serial) return;
      await invoke("adb_mirror_touch_event", {
        serial,
        action,
        x,
        y,
      });
      return;
    }

    if (streamSource.value === "chrome") {
      const target = resolvePreferredChromeTarget();
      if (target && action === "down") {
        await activateChromeTarget(target);
      }
      if (!chromeClient) {
        const target = resolvePreferredChromeTarget();
        if (!target) return;
        chromeClient = await ensureChromeClient(target);
      }

      const dispatchMouse = async () => {
        const eventType =
          action === "down" ? "mousePressed" : action === "up" ? "mouseReleased" : "mouseMoved";
        if (action === "down") pointerDown = true;
        if (action === "up") pointerDown = false;
        await chromeClient!.send("Input.dispatchMouseEvent", {
          type: eventType,
          x,
          y,
          button: "left",
          buttons: pointerDown || action === "down" ? 1 : 0,
          clickCount: action === "move" ? 0 : 1,
        });
      };

      if (isChromePhoneMode()) {
        const touchType =
          action === "down" ? "touchStart" : action === "up" ? "touchEnd" : "touchMove";
        if (action === "down") pointerDown = true;
        if (action === "up") pointerDown = false;
        try {
          await chromeClient.send("Input.dispatchTouchEvent", {
            type: touchType,
            touchPoints:
              action === "up"
                ? []
                : [
                    {
                      id: 1,
                      x,
                      y,
                      radiusX: 1,
                      radiusY: 1,
                      force: 1,
                    },
                  ],
            modifiers: 0,
          });
          return;
        } catch {}
      }

      await dispatchMouse();
    }
  }

  async function processTouchQueue() {
    if (touchProcessing) return;
    if (!mirrorStore.isStreaming) {
      touchQueue = [];
      return;
    }
    touchProcessing = true;
    while (touchQueue.length > 0) {
      const item = touchQueue.shift();
      if (!item) continue;
      const queuedMs = performance.now() - item.enqueuedAt;
      const invokeStartedAt = performance.now();
      try {
        await dispatchTouch(item.action, item.x, item.y);
        const invokeMs = performance.now() - invokeStartedAt;
        touchSent += 1;
        touchInvokeMsTotal += invokeMs;
        touchQueueDelayMsTotal += queuedMs;
      } catch (touchErr) {
        if (item.action !== "move") {
          error.value = String(touchErr);
        }
      }
      const elapsed = performance.now() - touchStatsWindowStartedAt;
      if (elapsed >= 1000) resetTouchStats();
    }
    touchProcessing = false;
  }

  function sendTouch(action: TouchAction, x: number, y: number) {
    if (!mirrorStore.isStreaming) return;
    if (action === "move" && touchQueue.length > 0) {
      const lastIndex = touchQueue.length - 1;
      const last = touchQueue[lastIndex];
      if (last.action === "move") {
        touchQueue[lastIndex] = {
          action,
          x,
          y,
          enqueuedAt: performance.now(),
        };
        touchCoalesced += 1;
        return;
      }
    }
    touchQueue.push({
      action,
      x,
      y,
      enqueuedAt: performance.now(),
    });
    void processTouchQueue();
  }

  async function sendWheel(x: number, y: number, deltaX: number, deltaY: number) {
    if (!mirrorStore.isStreaming) return;

    if (streamSource.value === "adb") {
      const serial = resolveAdbSerial();
      if (!serial) return;
      try {
        await invoke("adb_mirror_scroll_event", {
          serial,
          x,
          y,
          hScroll: -clampScrollDelta(deltaX),
          vScroll: -clampScrollDelta(deltaY),
        });
      } catch (scrollErr) {
        error.value = String(scrollErr);
      }
      return;
    }

    if (streamSource.value === "chrome") {
      if (!chromeClient) {
        const target = resolvePreferredChromeTarget();
        if (!target) return;
        chromeClient = await ensureChromeClient(target);
      }
      await chromeClient.send("Input.dispatchMouseEvent", {
        type: "mouseWheel",
        x,
        y,
        deltaX,
        deltaY,
      });
    }
  }

  async function pasteHostClipboardToDevice() {
    if (streamSource.value !== "adb") return;
    const serial = resolveAdbSerial();
    if (!serial) return;
    const text = await readHostClipboardText().catch(() => "");
    if (!text) return;
    await invoke("adb_mirror_set_clipboard", { serial, text, paste: true });
  }

  async function requestDeviceClipboard(copyKey: number) {
    if (streamSource.value !== "adb") return;
    const serial = resolveAdbSerial();
    if (!serial) return;
    await invoke("adb_mirror_get_clipboard", { serial, copyKey });
  }

  async function sendKeyboard(event: MirrorKeyboardEvent) {
    if (!mirrorStore.isStreaming) return;

    try {
      if (streamSource.value === "chrome") {
        if (!chromeClient) {
          const target = resolvePreferredChromeTarget();
          if (!target) return;
          chromeClient = await ensureChromeClient(target);
        }
        const windowsVirtualKeyCode = getWindowsVirtualKeyCode(event);
        await chromeClient.send("Input.dispatchKeyEvent", {
          type: "keyDown",
          key: event.key,
          code: event.code,
          windowsVirtualKeyCode,
          modifiers: getChromeModifiers(event),
        });
        await chromeClient.send("Input.dispatchKeyEvent", {
          type: "keyUp",
          key: event.key,
          code: event.code,
          windowsVirtualKeyCode,
          modifiers: getChromeModifiers(event),
        });
        return;
      }

      if (streamSource.value !== "adb") return;

      const shortcutKey = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && shortcutKey === "v") {
        await pasteHostClipboardToDevice();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && shortcutKey === "c") {
        await requestDeviceClipboard(SCRCPY_COPY_KEY_COPY);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && shortcutKey === "x") {
        await requestDeviceClipboard(SCRCPY_COPY_KEY_CUT);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && shortcutKey === "a") {
        await sendAndroidKeycode(AndroidKey.A, ANDROID_META_CTRL_ON);
        return;
      }

      const serial = resolveAdbSerial();
      if (!serial) return;

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        await invoke("adb_mirror_inject_text", { serial, text: event.key });
        return;
      }

      const keycode = resolveSpecialAndroidKey(event);
      if (!keycode) return;
      await sendAndroidKeycode(keycode, getAndroidMetaState(event));
    } catch (keyboardErr) {
      error.value = String(keyboardErr);
    }
  }

  async function startRecording() {
    if (streamSource.value !== "adb") {
      toast.info("Recording available only for Android mirror stream");
      return;
    }
    const serial = resolveAdbSerial();
    if (!serial) return;
    try {
      await invoke("adb_mirror_start_recording", { serial });
      mirrorStore.isRecording = true;
      toast.info("Recording started");
    } catch (recordErr) {
      toast.error("Recording failed", { description: String(recordErr) });
    }
  }

  async function stopRecording() {
    if (streamSource.value !== "adb") return;
    const serial = resolveAdbSerial();
    if (!serial) return;
    try {
      const { downloadDir, join } = await import("@tauri-apps/api/path");
      const dir = await downloadDir();
      const savePath = await join(dir, `capubridge_rec_${Date.now()}.mp4`);
      toast.info("Saving recording…");
      await invoke("adb_mirror_stop_recording", {
        serial,
        savePath,
      });
      mirrorStore.isRecording = false;
      toast.success("Recording saved", { description: savePath });
    } catch (saveErr) {
      mirrorStore.isRecording = false;
      toast.error("Save failed", { description: String(saveErr) });
    }
  }

  async function launchExternalScrcpy() {
    const serial = resolveAdbSerial();
    if (!serial) {
      toast.error("No device selected");
      return;
    }
    try {
      const maxSize = mirrorStore.settings.recordQuality === "720p" ? 1280 : 1920;
      const bitRateMbps = mirrorStore.settings.recordBitrate;
      const maxFps = Math.max(30, mirrorStore.settings.fps);
      await invoke("adb_mirror_launch_scrcpy", {
        serial,
        maxSize,
        bitRateMbps,
        maxFps,
      });
      toast.success("Opened native scrcpy window");
    } catch (externalErr) {
      toast.error("Failed to start scrcpy", {
        description: String(externalErr),
      });
    }
  }

  onUnmounted(() => {
    cleanupScrcpyDecoder();
    cleanupChromeFrameQueue();
    cleanupChromePolling();
    void stopChromeScreencast();
    cleanupChromeListeners();
    cleanupDeviceClipboardListener();
  });

  return {
    useScrcpyCanvas,
    streamSource,
    isAndroidStream,
    isConnected,
    error,
    startStream,
    stopStream,
    downloadScreenshot,
    sendKey,
    sendTouch,
    sendWheel,
    sendKeyboard,
    startRecording,
    stopRecording,
    launchExternalScrcpy,
    setCanvasElement,
    applyChromeViewportMode,
  };
}
