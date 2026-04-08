import { onUnmounted, ref } from "vue";
import { Channel, invoke } from "@tauri-apps/api/core";
import { toast } from "vue-sonner";
import { useDevicesStore } from "@/stores/devices.store";
import { useMirrorStore } from "@/stores/mirror.store";

export const AndroidKey = {
  HOME: 3,
  BACK: 4,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  POWER: 26,
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

export function useMirrorStream() {
  const mirrorStore = useMirrorStore();
  const devicesStore = useDevicesStore();

  const useScrcpyCanvas = ref(false);
  const isConnected = ref(false);
  const error = ref<string | null>(null);
  const canvasElement = ref<HTMLCanvasElement | null>(null);

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

  function b64ToBytes(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
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

  function logTouchStatsIfNeeded() {
    if (!import.meta.env.DEV) return;
    const elapsed = performance.now() - touchStatsWindowStartedAt;
    if (elapsed < 1000 || touchSent === 0) return;
    console.debug("[mirror-input]", {
      sentPerSec: Number(((touchSent * 1000) / elapsed).toFixed(1)),
      coalescedMoves: touchCoalesced,
      avgInvokeMs: Number((touchInvokeMsTotal / touchSent).toFixed(2)),
      avgQueueDelayMs: Number((touchQueueDelayMsTotal / touchSent).toFixed(2)),
      queued: touchQueue.length,
    });
    resetTouchStats();
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

  function setCanvasElement(el: HTMLCanvasElement | null) {
    canvasElement.value = el;
  }

  async function failScrcpy(serial: string, reason: string, id: number) {
    if (id !== sessionId) return;
    if (import.meta.env.DEV) {
      console.warn("[mirror-scrcpy] stream failed:", reason);
    }
    clearStartupTimeout();
    try {
      await invoke("adb_mirror_scrcpy_stop", { serial });
    } catch {}
    cleanupScrcpyDecoder();
    touchQueue = [];
    touchProcessing = false;
    useScrcpyCanvas.value = false;
    isConnected.value = false;
    mirrorStore.isStreaming = false;
    error.value = reason;
  }

  async function startStream() {
    const device = devicesStore.selectedDevice;
    if (!device || device.status !== "online") return;

    sessionId += 1;
    const activeSessionId = sessionId;

    error.value = null;
    cleanupScrcpyDecoder();
    touchQueue = [];
    touchProcessing = false;
    resetTouchStats();
    useScrcpyCanvas.value = false;
    isConnected.value = false;
    mirrorStore.isStreaming = false;

    const canUseWebCodecs =
      typeof window !== "undefined" &&
      typeof VideoDecoder !== "undefined" &&
      typeof EncodedVideoChunk !== "undefined";
    if (!canUseWebCodecs) {
      const msg = "WebCodecs is not available on this platform.";
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
            void failScrcpy(device.serial, `decoder error: ${String(decodeErr)}`, activeSessionId);
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
              void failScrcpy(
                device.serial,
                `codec not supported: ${msg.data.codec}`,
                activeSessionId,
              );
              return;
            }
            nextDecoder.configure(config);
            decoder = nextDecoder;
          })
          .catch((configErr) => {
            nextDecoder.close();
            void failScrcpy(
              device.serial,
              `config check failed: ${String(configErr)}`,
              activeSessionId,
            );
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
          void failScrcpy(
            device.serial,
            `packet decode failed: ${String(decodeErr)}`,
            activeSessionId,
          );
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
      const streamSettings: ScrcpyStreamSettings = {
        maxSize: mirrorStore.settings.recordQuality === "720p" ? 1280 : 1920,
        maxFps: Math.max(30, mirrorStore.settings.fps),
        videoBitRate: mirrorStore.settings.recordBitrate * 1_000_000,
        videoCodec: "h264",
      };
      const [width, height] = await invoke<[number, number]>("adb_mirror_scrcpy_start", {
        serial: device.serial,
        settings: streamSettings,
        onFrame: channel,
      });

      if (activeSessionId !== sessionId) return;

      mirrorStore.setDeviceSize(width, height);
      useScrcpyCanvas.value = true;
      isConnected.value = true;
      mirrorStore.isStreaming = true;

      startupTimeout = setTimeout(() => {
        if (!firstFrameSeen) {
          void failScrcpy(
            device.serial,
            "startup timeout waiting for first decoded frame",
            activeSessionId,
          );
        }
      }, 2200);
    } catch (startErr) {
      if (activeSessionId !== sessionId) return;
      error.value = String(startErr);
      toast.error("Mirror failed to start", { description: String(startErr) });
    }
  }

  async function stopStream() {
    sessionId += 1;
    const device = devicesStore.selectedDevice;
    if (device) {
      try {
        await invoke("adb_mirror_scrcpy_stop", { serial: device.serial });
      } catch {}
    }
    cleanupScrcpyDecoder();
    touchQueue = [];
    touchProcessing = false;
    useScrcpyCanvas.value = false;
    isConnected.value = false;
    mirrorStore.isStreaming = false;
    error.value = null;
  }

  async function takeScreenshot(): Promise<string> {
    const device = devicesStore.selectedDevice;
    if (!device) throw new Error("No device selected");
    return invoke<string>("adb_mirror_screenshot", { serial: device.serial });
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
    const device = devicesStore.selectedDevice;
    if (!device) return;
    try {
      await invoke("adb_mirror_keyevent", { serial: device.serial, keycode });
    } catch (keyErr) {
      toast.error("Key event failed", { description: String(keyErr) });
    }
  }

  async function processTouchQueue() {
    if (touchProcessing) return;
    const device = devicesStore.selectedDevice;
    if (!device) {
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
        await invoke("adb_mirror_touch_event", {
          serial: device.serial,
          action: item.action,
          x: item.x,
          y: item.y,
        });
        const invokeMs = performance.now() - invokeStartedAt;
        touchSent += 1;
        touchInvokeMsTotal += invokeMs;
        touchQueueDelayMsTotal += queuedMs;
        if (import.meta.env.DEV && item.action !== "move") {
          console.debug("[mirror-input]", {
            action: item.action,
            invokeMs: Number(invokeMs.toFixed(2)),
            queueDelayMs: Number(queuedMs.toFixed(2)),
            queued: touchQueue.length,
          });
        }
      } catch (touchErr) {
        if (import.meta.env.DEV) {
          console.warn("[mirror-input] touch send failed", {
            action: item.action,
            error: String(touchErr),
          });
        }
        if (item.action !== "move") {
          error.value = String(touchErr);
        }
      }
      logTouchStatsIfNeeded();
    }
    touchProcessing = false;
  }

  function sendTouch(action: TouchAction, x: number, y: number) {
    const device = devicesStore.selectedDevice;
    if (!device) return;
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

  async function startRecording() {
    const device = devicesStore.selectedDevice;
    if (!device) return;
    try {
      await invoke("adb_mirror_start_recording", { serial: device.serial });
      mirrorStore.isRecording = true;
      toast.info("Recording started");
    } catch (recordErr) {
      toast.error("Recording failed", { description: String(recordErr) });
    }
  }

  async function stopRecording() {
    const device = devicesStore.selectedDevice;
    if (!device) return;
    try {
      const { downloadDir, join } = await import("@tauri-apps/api/path");
      const dir = await downloadDir();
      const savePath = await join(dir, `capubridge_rec_${Date.now()}.mp4`);
      toast.info("Saving recording…");
      await invoke("adb_mirror_stop_recording", { serial: device.serial, savePath });
      mirrorStore.isRecording = false;
      toast.success("Recording saved", { description: savePath });
    } catch (saveErr) {
      mirrorStore.isRecording = false;
      toast.error("Save failed", { description: String(saveErr) });
    }
  }

  async function launchExternalScrcpy() {
    const device = devicesStore.selectedDevice;
    if (!device) {
      toast.error("No device selected");
      return;
    }
    try {
      const maxSize = mirrorStore.settings.recordQuality === "720p" ? 1280 : 1920;
      const bitRateMbps = mirrorStore.settings.recordBitrate;
      const maxFps = Math.max(30, mirrorStore.settings.fps);
      await invoke("adb_mirror_launch_scrcpy", {
        serial: device.serial,
        maxSize,
        bitRateMbps,
        maxFps,
      });
      toast.success("Opened native scrcpy window");
    } catch (externalErr) {
      toast.error("Failed to start scrcpy", { description: String(externalErr) });
    }
  }

  onUnmounted(() => {
    cleanupScrcpyDecoder();
  });

  return {
    useScrcpyCanvas,
    isConnected,
    error,
    startStream,
    stopStream,
    downloadScreenshot,
    sendKey,
    sendTouch,
    startRecording,
    stopRecording,
    launchExternalScrcpy,
    setCanvasElement,
  };
}
