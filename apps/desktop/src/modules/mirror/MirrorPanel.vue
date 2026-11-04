<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useMirrorStore } from "@/stores/mirror.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useInspectStore } from "@/stores/inspect.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useCDP } from "@/composables/useCDP";
import { useMirrorViewportWidth } from "./useMirrorViewportWidth";
import { AndroidKey, useMirrorStream } from "./useMirrorStream";
import { getDetachedMirrorLayoutMetrics } from "./detachedMirrorLayout";
import MirrorStream from "./MirrorStream.vue";
import LocalWebviewHost from "./LocalWebviewHost.vue";
import MirrorDeviceBar from "./MirrorDeviceBar.vue";
import MirrorDeviceFrame from "./MirrorDeviceFrame.vue";
import MirrorTopBar from "./MirrorTopBar.vue";
import MirrorStateOverlay from "./MirrorStateOverlay.vue";
import MirrorPresenceNotice from "./MirrorPresenceNotice.vue";
import { describeMirrorStatus } from "./mirrorStatus";
import { orientationOfSize } from "./deviceRotation";
import { useMirrorFrameStats } from "./useMirrorFrameStats";
import { useMirrorRecordingClock } from "./useMirrorRecordingClock";

const mirrorStore = useMirrorStore();
const devicesStore = useDevicesStore();
const inspectStore = useInspectStore();
const targetsStore = useTargetsStore();
const localWebviewStore = useLocalWebviewStore();
const { connectToTarget } = useCDP();
const {
  useScrcpyCanvas,
  isAndroidStream,
  isConnected,
  error: streamError,
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
  readFrames,
} = useMirrorStream();

const isResizing = ref(false);
const deviceFrameRef = ref<InstanceType<typeof MirrorDeviceFrame> | null>(null);
const streamAreaRef = computed(() => deviceFrameRef.value?.well ?? null);
const { panelWidth } = useMirrorViewportWidth(streamAreaRef);
const selectedTarget = computed(() => targetsStore.selectedTarget);
const isLocalTarget = computed(() => selectedTarget.value?.source === "local");
const androidMode = computed(() => !isLocalTarget.value && isAndroidStream.value);
const canUseStreamActions = computed(() => !isLocalTarget.value && mirrorStore.isStreaming);
const presenceStore = useTargetPresenceStore();
const streamSerial = computed(() => {
  const device = devicesStore.selectedDevice;
  if (device?.status === "online") return device.serial;
  const target = selectedTarget.value;
  return target?.source === "adb" ? (target.deviceSerial ?? null) : null;
});
const streamOrientation = computed(() =>
  orientationOfSize(mirrorStore.deviceWidth, mirrorStore.deviceHeight),
);
const streamWanted = computed(
  () => mirrorStore.isOpen && !mirrorStore.isDetached && !isLocalTarget.value,
);
const { frames } = useMirrorFrameStats(readFrames, streamWanted);
const { timecode: recordingTimecode } = useMirrorRecordingClock(
  computed(() => mirrorStore.isRecording),
);
const status = computed(() =>
  describeMirrorStatus({
    active: streamWanted.value,
    isConnected: isConnected.value,
    error: streamError.value,
    frames: frames.value,
  }),
);
const presenceNotice = computed(() => {
  const target = selectedTarget.value;
  if (!androidMode.value || target?.source !== "adb") return null;
  const presence = presenceStore.presence;
  if (presence !== "background" && presence !== "view-hidden") return null;
  return { presence, appName: target.title?.trim() || target.packageName || "The app" };
});

function syncLocalViewportSize() {
  if (!isLocalTarget.value) return;
  if (mirrorStore.settings.chromeViewportMode === "phone") {
    mirrorStore.setDeviceSize(390, 844);
    return;
  }
  mirrorStore.setDeviceSize(1280, 800);
}

async function applyLocalWebviewViewportMode() {
  const target = selectedTarget.value;
  if (!target || target.source !== "local") return;

  const readyTarget = await localWebviewStore.ensureCdpTarget(target).catch((error) => {
    console.warn("Local webview viewport sync skipped: CDP unavailable", error);
    return null;
  });
  if (!readyTarget?.webSocketDebuggerUrl) return;
  const client = await connectToTarget(readyTarget);

  await nextTick();
  const frame = deviceFrameRef.value?.screen ?? null;

  if (mirrorStore.settings.chromeViewportMode === "phone" && frame) {
    const rect = frame.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    await Promise.allSettled([
      client.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: true,
      }),
      client.send("Emulation.setTouchEmulationEnabled", {
        enabled: true,
        maxTouchPoints: 1,
      }),
      client.send("Emulation.setEmitTouchEventsForMouse", {
        enabled: true,
        configuration: "mobile",
      }),
    ]);
    return;
  }

  await Promise.allSettled([
    client.send("Emulation.clearDeviceMetricsOverride"),
    client.send("Emulation.setTouchEmulationEnabled", {
      enabled: false,
      maxTouchPoints: 0,
    }),
    client.send("Emulation.setEmitTouchEventsForMouse", {
      enabled: false,
      configuration: "desktop",
    }),
  ]);
}

function startResize(e: MouseEvent) {
  isResizing.value = true;
  const startX = e.clientX;
  const startWidth = mirrorStore.width;
  const isLeft = mirrorStore.side === "left";

  function onMove(ev: MouseEvent) {
    const delta = ev.clientX - startX;
    mirrorStore.setWidth(startWidth + (isLeft ? delta : -delta));
  }

  function onWheel() {}

  function onUp() {
    isResizing.value = false;
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  window.addEventListener("wheel", onWheel);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function handleStreamNavigation(action: "back" | "home") {
  void sendKey(action === "back" ? AndroidKey.BACK : AndroidKey.HOME);
}

async function handleRefresh() {
  if (isLocalTarget.value) {
    const target = selectedTarget.value;
    if (!target || target.source !== "local") return;
    try {
      const readyTarget = await localWebviewStore.ensureCdpTarget(target).catch((error) => {
        console.warn("Local webview CDP unavailable; reloading through navigation", error);
        return null;
      });
      if (readyTarget?.webSocketDebuggerUrl) {
        const client = await connectToTarget(readyTarget);
        await client.send("Page.reload", { ignoreCache: true });
        await applyLocalWebviewViewportMode();
        return;
      }
      if (target.localWebviewLabel) {
        await localWebviewStore.navigateSource(target.localWebviewLabel, target.url);
      }
    } catch (err) {
      toast.error("Failed to refresh local webview", { description: String(err) });
    }
    return;
  }

  if (mirrorStore.isOpen && !mirrorStore.isDetached) {
    await stopStream();
    await startStream();
  }
}

watch(
  () => mirrorStore.isOpen,
  (open) => {
    if (open && !mirrorStore.isDetached) {
      if (isLocalTarget.value) {
        void stopStream().then(async () => {
          syncLocalViewportSize();
          await applyLocalWebviewViewportMode();
        });
        return;
      }
      void startStream();
      return;
    }

    void stopStream();
  },

  { immediate: true },
);

watch(
  () => devicesStore.selectedDevice?.serial,
  () => {
    if (isLocalTarget.value) return;
    if (mirrorStore.isOpen && !mirrorStore.isDetached) {
      void stopStream().then(() => startStream());
    }
  },
);

watch(
  () => targetsStore.selectedTarget?.id ?? null,
  () => {
    if (mirrorStore.isOpen && !mirrorStore.isDetached) {
      if (isLocalTarget.value) {
        void stopStream().then(async () => {
          syncLocalViewportSize();
          await applyLocalWebviewViewportMode();
        });
        return;
      }
      void stopStream().then(() => startStream());
    }
  },
);

watch(
  () => [panelWidth.value, mirrorStore.deviceWidth, mirrorStore.deviceHeight] as const,
  () => {
    if (mirrorStore.isOpen && !mirrorStore.isDetached && isLocalTarget.value) {
      void applyLocalWebviewViewportMode();
    }
  },
);

watch(
  () => mirrorStore.settings.fps,
  (next, prev) => {
    if (next === prev) return;
    if (mirrorStore.isOpen && !mirrorStore.isDetached && mirrorStore.isStreaming) {
      void stopStream().then(() => startStream());
    }
  },
);

watch(
  () => mirrorStore.settings.chromeViewportMode,
  (next, prev) => {
    if (next === prev) return;
    if (
      mirrorStore.isOpen &&
      !mirrorStore.isDetached &&
      mirrorStore.isStreaming &&
      !androidMode.value
    ) {
      void applyChromeViewportMode().catch((error) => {
        console.warn("Failed to update Chrome mirror viewport; restarting stream", error);
        void stopStream().then(() => startStream());
      });
    }
    if (mirrorStore.isOpen && !mirrorStore.isDetached && isLocalTarget.value) {
      syncLocalViewportSize();
      void applyLocalWebviewViewportMode();
    }
  },
);

async function handleDetach() {
  if (isLocalTarget.value) {
    toast.info("Local webview stays in the main window");
    return;
  }
  await stopStream();
  mirrorStore.isDetached = true;

  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const metrics = getDetachedMirrorLayoutMetrics({
      preferredWidth: mirrorStore.preferredWidth,
      aspectRatio: mirrorStore.aspectRatio,
      availWidth: window.screen.availWidth,
      availHeight: window.screen.availHeight,
      mode: "panel",
      settingsOpen: false,
      isRecording: mirrorStore.isRecording,
    });
    const win = new WebviewWindow("mirror-detached", {
      url: "/?mirror=1",
      title: "Device Mirror",
      width: metrics.windowWidth,
      height: metrics.windowHeight,
      minWidth: 212,
      minHeight: 420,
      resizable: false,
      decorations: false,
      alwaysOnTop: mirrorStore.alwaysOnTop,
    });

    void win
      .once("tauri://destroyed", () => {
        mirrorStore.isDetached = false;
        if (mirrorStore.isOpen) void startStream();
      })
      .catch((error) => {
        console.warn("Failed to subscribe to detached mirror close event", error);
      });

    void win
      .once("tauri://error", () => {
        mirrorStore.isDetached = false;
        toast.error("Failed to open mirror window");
        void startStream();
      })
      .catch((error) => {
        mirrorStore.isDetached = false;
        toast.error("Failed to monitor mirror window startup", { description: String(error) });
        void startStream();
      });
  } catch (e) {
    mirrorStore.isDetached = false;
    toast.error("Failed to detach mirror", { description: String(e) });
    void startStream();
  }
}

function handleInspectHover(x: number, y: number) {
  if (!inspectStore.inspectMode) return;
  inspectStore.setMirrorHoverPoint(x, y);
}

function handleInspectSelect(x: number, y: number) {
  if (!inspectStore.inspectMode) return;
  inspectStore.setMirrorSelectPoint(x, y);
}

function handleInspectLeave() {
  if (!inspectStore.inspectMode) return;
  inspectStore.clearMirrorHoverPoint();
}

function toggleRecord() {
  if (mirrorStore.isRecording) void stopRecording();
  else void startRecording();
}
</script>

<template>
  <aside
    aria-label="Device screen"
    class="relative flex h-full shrink-0"
    :style="{ width: `${panelWidth}px` }"
  >
    <div
      class="group absolute inset-y-0 z-10 flex w-2 cursor-col-resize items-center justify-center"
      :class="mirrorStore.side === 'right' ? '-left-2' : '-right-2'"
      @mousedown.prevent="startResize"
    >
      <div
        class="h-8 w-px rounded-full transition-colors group-hover:bg-border-active"
        :class="isResizing ? 'bg-border-active' : 'bg-transparent'"
      />
    </div>

    <div
      class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-surface border border-border-subtle bg-surface-0 shadow-bevel"
    >
      <MirrorTopBar
        :status="status"
        :is-recording="mirrorStore.isRecording"
        :recording-timecode="recordingTimecode"
        :can-capture="canUseStreamActions"
        :android-mode="androidMode"
        :is-local="isLocalTarget"
        :laser-mode="mirrorStore.laserMode"
        :side="mirrorStore.side"
        @screenshot="downloadScreenshot"
        @toggle-record="toggleRecord"
        @detach="handleDetach"
        @toggle-laser="mirrorStore.laserMode = !mirrorStore.laserMode"
        @toggle-side="mirrorStore.setSide(mirrorStore.side === 'right' ? 'left' : 'right')"
        @launch-scrcpy="launchExternalScrcpy"
        @refresh="handleRefresh"
      />

      <MirrorPresenceNotice
        v-if="presenceNotice"
        :presence="presenceNotice.presence"
        :app-name="presenceNotice.appName"
      />

      <MirrorDeviceFrame
        ref="deviceFrameRef"
        :device-width="mirrorStore.deviceWidth"
        :device-height="mirrorStore.deviceHeight"
        :class="androidMode ? '' : 'mb-2'"
      >
        <LocalWebviewHost v-if="isLocalTarget" :target="selectedTarget" />
        <MirrorStream
          v-else
          :use-canvas="useScrcpyCanvas"
          :is-connected="isConnected"
          :laser-mode="mirrorStore.laserMode"
          :device-width="mirrorStore.deviceWidth"
          :device-height="mirrorStore.deviceHeight"
          :inspect-mode="inspectStore.inspectMode"
          @touch="sendTouch"
          @wheel="sendWheel"
          @navigation="handleStreamNavigation"
          @keyboard="sendKeyboard"
          @inspect-hover="handleInspectHover"
          @inspect-select="handleInspectSelect"
          @inspect-leave="handleInspectLeave"
          @canvas-ready="setCanvasElement"
        >
          <template #state>
            <MirrorStateOverlay
              :phase="status.phase"
              :error="streamError"
              :detached="mirrorStore.isDetached"
              @restart="startStream"
            />
          </template>
        </MirrorStream>
      </MirrorDeviceFrame>

      <div v-if="androidMode" class="shrink-0 p-2">
        <MirrorDeviceBar
          :serial="streamSerial"
          :stream-orientation="streamOrientation"
          :disabled="!streamSerial"
          @keyevent="sendKey"
        />
      </div>
    </div>
  </aside>
</template>
