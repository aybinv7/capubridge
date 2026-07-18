import { markRaw, onUnmounted } from "vue";
import { toast } from "vue-sonner";
import { useCDP } from "@/composables/useCDP";
import { invokeCommand } from "@/runtime/ipc";
import { runSessionEffect, startMirrorLeaseEffect, stopMirrorLeaseEffect } from "@/runtime/session";
import { useDevicesStore } from "@/stores/devices.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useSourceStore } from "@/stores/source.store";
import type { CDPTarget } from "@/types/cdp.types";
import MediaSavedToast from "@/components/common/MediaSavedToast.vue";
import { createMirrorDecoder } from "./mirrorDecoder";
import { createMirrorInput } from "./mirrorInput";
import { createMirrorLifecycle } from "./mirrorLifecycle";
import { createMirrorStreamState } from "./mirrorState";
import { createAdbMirrorTransport, createChromeMirrorTransport } from "./mirrorTransport";
import type { ScrcpyStreamSettings } from "./mirrorTypes";

export { AndroidKey } from "./mirrorTypes";
export type { AndroidKeyCode } from "./mirrorTypes";

export function useMirrorStream() {
  const mirrorStore = useMirrorStore();
  const devicesStore = useDevicesStore();
  const sourceStore = useSourceStore();
  const { activeClient, connectToTarget, targetsStore, connectionStore } = useCDP();
  const state = createMirrorStreamState(mirrorStore);
  const adb = createAdbMirrorTransport();

  const lifecycle = createMirrorLifecycle({
    start: (serial) =>
      runSessionEffect(startMirrorLeaseEffect(serial), {
        operation: "session.startMirrorLease",
      }),
    stop: (serial) =>
      runSessionEffect(stopMirrorLeaseEffect(serial), {
        operation: "session.stopMirrorLease",
      }),
    onStopError: (serial, cause) => {
      console.warn("Failed to release mirror session lease", serial, cause);
    },
  });

  function resolvePreferredChromeTarget(): CDPTarget | null {
    const selectedTarget = targetsStore.selectedTarget;
    if (selectedTarget) {
      if (selectedTarget.source !== "chrome") return null;
      return selectedTarget;
    }
    return (
      targetsStore.targets.find((target) => target.source === "chrome" && target.type === "page") ??
      targetsStore.targets.find((target) => target.source === "chrome") ??
      null
    );
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
    if (serial && (!selectedTarget || selectedTarget.source === "adb")) return "adb";
    if (resolvePreferredChromeTarget()) return "chrome";
    if (serial) return "adb";
    return null;
  }

  const decoder = createMirrorDecoder({
    canvasElement: state.canvasElement,
    isSessionCurrent: lifecycle.isSessionCurrent,
    onScrcpyFailure: failScrcpy,
    onChromeFailure: failChrome,
    onDeviceSize: mirrorStore.setDeviceSize,
    onFrameRendered: lifecycle.clearStartupTimeout,
    getFallbackSize: () => ({
      deviceWidth: mirrorStore.deviceWidth || 1080,
      deviceHeight: mirrorStore.deviceHeight || 1920,
    }),
  });

  const chrome = createChromeMirrorTransport({
    activeClient,
    activeTargetId: () => connectionStore.activeConnection?.targetId ?? null,
    connectToTarget,
    resolveTarget: resolvePreferredChromeTarget,
    getChromePort: () => sourceStore.getChromeSource()?.port ?? null,
    getViewportMode: () => mirrorStore.settings.chromeViewportMode,
    getFps: () => mirrorStore.settings.fps,
    getMaxSize: () => (mirrorStore.settings.recordQuality === "720p" ? 1280 : 1920),
    isSessionCurrent: lifecycle.isSessionCurrent,
    isStreaming: () => state.streamSource.value === "chrome" && mirrorStore.isStreaming,
    setDeviceSize: mirrorStore.setDeviceSize,
    markConnected: state.markConnected,
    clearStartupTimeout: lifecycle.clearStartupTimeout,
    scheduleStartupTimeout: lifecycle.scheduleStartupTimeout,
    onFailure: failChrome,
    decoder,
  });

  const input = createMirrorInput({
    adb,
    getSource: () => state.streamSource.value,
    isStreaming: () => mirrorStore.isStreaming,
    resolveSerial: resolveAdbSerial,
    getChromeClient: chrome.getPreferredClient,
    activateChromeTarget: chrome.activatePreferredTarget,
    isChromePhoneMode: () => mirrorStore.settings.chromeViewportMode === "phone",
    setError: (message) => {
      state.error.value = message;
    },
    onKeyError: (cause) => {
      toast.error("Key event failed", { description: String(cause) });
    },
  });

  function cleanupControllers() {
    lifecycle.clearStartupTimeout();
    decoder.cleanup();
    chrome.cleanup();
    input.reset();
  }

  async function failScrcpy(serial: string, reason: string, sessionId: number) {
    if (!lifecycle.isSessionCurrent(sessionId)) return;
    await lifecycle.releaseLease(serial);
    cleanupControllers();
    state.markDisconnected({ reason });
  }

  async function failChrome(reason: string, sessionId: number) {
    if (!lifecycle.isSessionCurrent(sessionId)) return;
    lifecycle.clearStartupTimeout();
    await chrome.stopScreencast();
    cleanupControllers();
    state.markDisconnected({ reason });
  }

  async function startAdbStream(serial: string, sessionId: number) {
    const canUseWebCodecs =
      typeof window !== "undefined" &&
      typeof VideoDecoder !== "undefined" &&
      typeof EncodedVideoChunk !== "undefined";
    if (!canUseWebCodecs) {
      const message = "WebCodecs is not available on this platform.";
      await lifecycle.releaseLease(serial);
      state.error.value = message;
      toast.error("Mirror unavailable", { description: message });
      return;
    }

    const scrcpy = decoder.createScrcpyChannel(
      serial,
      sessionId,
      lifecycle.clearStartupTimeout,
      (reason) => {
        lifecycle.clearStartupTimeout();
        decoder.cleanupScrcpy();
        state.markDisconnected({
          reason: reason !== "stopped" ? reason || "scrcpy stream disconnected" : undefined,
        });
      },
    );

    try {
      await decoder.waitForCanvas(1000);
      if (!lifecycle.isSessionCurrent(sessionId)) return;
      const settings: ScrcpyStreamSettings = {
        maxSize: mirrorStore.settings.recordQuality === "720p" ? 1280 : 1920,
        maxFps: Math.max(30, mirrorStore.settings.fps),
        videoBitRate: mirrorStore.settings.recordBitrate * 1_000_000,
        videoCodec: "h264",
      };
      const [width, height] = await adb.start(serial, settings, scrcpy.channel);
      if (!lifecycle.isSessionCurrent(sessionId)) return;
      mirrorStore.setDeviceSize(width, height);
      await input.setupClipboardListener();
      state.markConnected();
      lifecycle.scheduleStartupTimeout(() => {
        if (!scrcpy.hasFirstFrame()) {
          void failScrcpy(serial, "startup timeout waiting for first decoded frame", sessionId);
        }
      }, 5000);
    } catch (cause) {
      if (!lifecycle.isSessionCurrent(sessionId)) return;
      await lifecycle.releaseLease(serial);
      state.error.value = String(cause);
      toast.error("Mirror failed to start", { description: String(cause) });
    }
  }

  async function startStream() {
    const token = lifecycle.beginRun();
    cleanupControllers();
    input.cleanupClipboardListener();
    state.prepareStart();

    const preferredSource = resolvePreferredSource();
    if (!lifecycle.isCurrent(token)) return;
    if (!preferredSource) {
      const message = "Select target or online Android device before starting mirror.";
      state.error.value = message;
      toast.error("Mirror unavailable", { description: message });
      return;
    }

    state.selectSource(preferredSource);
    if (preferredSource === "chrome") {
      const target = resolvePreferredChromeTarget();
      if (!target) {
        const message = "No Chrome target selected for mirror preview.";
        state.error.value = message;
        state.markDisconnected();
        toast.error("Mirror unavailable", { description: message });
        return;
      }
      try {
        await chrome.start(target, token.sessionId);
      } catch (cause) {
        toast.error("Mirror failed to start", { description: String(cause) });
      }
      return;
    }

    const serial = resolveAdbSerial();
    if (!serial) {
      const message = "No online Android device selected for mirror.";
      state.error.value = message;
      state.markDisconnected();
      toast.error("Mirror unavailable", { description: message });
      return;
    }
    try {
      await lifecycle.acquireLease(serial);
      if (!lifecycle.isCurrent(token)) {
        await lifecycle.releaseLease(serial);
        return;
      }
    } catch (cause) {
      state.error.value = String(cause);
      state.markDisconnected();
      toast.error("Mirror unavailable", { description: String(cause) });
      return;
    }
    await startAdbStream(serial, token.sessionId);
  }

  async function stopStream() {
    const source = state.streamSource.value;
    lifecycle.invalidate();
    if (source === "adb") await lifecycle.releaseLease();
    if (source === "chrome") await chrome.stopScreencast();
    cleanupControllers();
    state.markDisconnected({ reason: null, clearRecording: true });
  }

  async function takeScreenshot() {
    if (state.streamSource.value === "chrome") return chrome.screenshot();
    const serial = resolveAdbSerial();
    if (!serial) throw new Error("No Android device selected");
    return adb.screenshot(serial);
  }

  async function downloadScreenshot() {
    try {
      const data = await takeScreenshot();
      const { downloadDir, join } = await import("@tauri-apps/api/path");
      const directory = await downloadDir();
      const filename = `screenshot_${Date.now()}.png`;
      const savePath = await join(directory, filename);
      await invokeCommand("save_base64_file", { path: savePath, data });
      toast.custom(markRaw(MediaSavedToast), {
        componentProps: {
          type: "screenshot",
          name: filename,
          path: savePath,
          thumbnailBase64: data,
        },
        duration: 5000,
      });
    } catch (cause) {
      toast.error("Screenshot failed", { description: String(cause) });
    }
  }

  async function startRecording() {
    if (state.streamSource.value !== "adb") {
      toast.info("Recording available only for Android mirror stream");
      return;
    }
    const serial = resolveAdbSerial();
    if (!serial) return;
    try {
      await adb.startRecording(serial);
      mirrorStore.isRecording = true;
      toast.info("Recording started");
    } catch (cause) {
      toast.error("Recording failed", { description: String(cause) });
    }
  }

  async function stopRecording() {
    if (state.streamSource.value !== "adb") return;
    const serial = resolveAdbSerial();
    if (!serial) return;
    try {
      const { downloadDir, join } = await import("@tauri-apps/api/path");
      const directory = await downloadDir();
      const filename = `capubridge_rec_${Date.now()}.mp4`;
      const savePath = await join(directory, filename);
      toast.info("Saving recording…", { id: "saving-recording" });
      await adb.stopRecording(serial, savePath);
      mirrorStore.isRecording = false;
      toast.dismiss("saving-recording");
      toast.custom(markRaw(MediaSavedToast), {
        componentProps: { type: "video", name: filename, path: savePath },
        duration: 5000,
      });
    } catch (cause) {
      mirrorStore.isRecording = false;
      toast.dismiss("saving-recording");
      toast.error("Save failed", { description: String(cause) });
    }
  }

  async function launchExternalScrcpy() {
    const serial = resolveAdbSerial();
    if (!serial) {
      toast.error("No device selected");
      return;
    }
    try {
      await adb.launchExternal(
        serial,
        mirrorStore.settings.recordQuality === "720p" ? 1280 : 1920,
        mirrorStore.settings.recordBitrate,
        Math.max(30, mirrorStore.settings.fps),
      );
      toast.success("Opened native scrcpy window");
    } catch (cause) {
      toast.error("Failed to start scrcpy", { description: String(cause) });
    }
  }

  async function applyChromeViewportMode() {
    if (state.streamSource.value === "chrome") await chrome.applyViewportMode();
  }

  onUnmounted(() => {
    lifecycle.invalidate();
    decoder.cleanup();
    void chrome.stopScreencast();
    chrome.cleanup();
    input.cleanupClipboardListener();
    void lifecycle.releaseLease();
  });

  return {
    useScrcpyCanvas: state.useScrcpyCanvas,
    streamSource: state.streamSource,
    isAndroidStream: state.isAndroidStream,
    isConnected: state.isConnected,
    error: state.error,
    startStream,
    stopStream,
    downloadScreenshot,
    sendKey: input.sendKey,
    sendTouch: input.sendTouch,
    sendWheel: input.sendWheel,
    sendKeyboard: input.sendKeyboard,
    startRecording,
    stopRecording,
    launchExternalScrcpy,
    setCanvasElement: state.setCanvasElement,
    applyChromeViewportMode,
  };
}
