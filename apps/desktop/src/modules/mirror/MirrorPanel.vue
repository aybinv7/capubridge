<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useWindowSize } from "@vueuse/core";
import { MAIN_AREA_MIN_WIDTH, WEB_PANEL_MIN_WIDTH, useMirrorStore } from "@/stores/mirror.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useInspectStore } from "@/stores/inspect.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import { useTargetPresenceStore } from "@/stores/targetPresence.store";
import { useCDP } from "@/composables/useCDP";
import { useMirrorViewportWidth } from "./useMirrorViewportWidth";
import { useLocalWebviewViewport } from "./useLocalWebviewViewport";
import { AndroidKey, useMirrorStream } from "./useMirrorStream";
import { getDetachedMirrorLayoutMetrics } from "./detachedMirrorLayout";
import MirrorStream from "./MirrorStream.vue";
import LocalWebviewHost from "./LocalWebviewHost.vue";
import MirrorDeviceBar from "./MirrorDeviceBar.vue";
import MirrorDeviceFrame from "./MirrorDeviceFrame.vue";
import MirrorTopBar from "./MirrorTopBar.vue";
import MirrorStateOverlay from "./MirrorStateOverlay.vue";
import MirrorBringToFront from "./MirrorBringToFront.vue";
import WebViewportBar from "./WebViewportBar.vue";
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
  captureScreenshot,
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
const screenRef = computed(() => deviceFrameRef.value?.screen ?? null);
const selectedTarget = computed(() => targetsStore.selectedTarget);
const localViewport = useLocalWebviewViewport(selectedTarget, screenRef);
const isLocalTarget = computed(() => selectedTarget.value?.source === "local");
const isWebPreview = computed(
  () => isLocalTarget.value || selectedTarget.value?.source === "chrome",
);
const { width: windowWidth } = useWindowSize();
const webMaxWidth = computed(() => windowWidth.value - MAIN_AREA_MIN_WIDTH);
const columnWidth = computed(() => {
  if (!isWebPreview.value) return panelWidth.value;
  const ceiling = Math.max(WEB_PANEL_MIN_WIDTH, webMaxWidth.value);
  return Math.min(ceiling, Math.max(WEB_PANEL_MIN_WIDTH, mirrorStore.webPanelWidth));
});
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
const backgroundApp = computed(() => {
  const target = selectedTarget.value;
  const serial = streamSerial.value;
  if (!androidMode.value || target?.source !== "adb" || !serial || !target.packageName) return null;
  if (presenceStore.presence !== "background") return null;
  return {
    serial,
    packageName: target.packageName,
    appName: target.title?.trim() || target.packageName,
  };
});

function startResize(e: MouseEvent) {
  isResizing.value = true;
  const startX = e.clientX;
  const web = isWebPreview.value;
  const startWidth = web ? columnWidth.value : mirrorStore.width;
  const isLeft = mirrorStore.side === "left";

  function onMove(ev: MouseEvent) {
    const delta = ev.clientX - startX;
    const next = startWidth + (isLeft ? delta : -delta);
    if (web) mirrorStore.setWebPanelWidth(next, webMaxWidth.value);
    else mirrorStore.setWidth(next);
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
        await localViewport.apply();
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
        void stopStream().then(() => localViewport.syncAndApply());
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
        void stopStream().then(() => localViewport.syncAndApply());
        return;
      }
      void stopStream().then(() => startStream());
    }
  },
);

watch(
  () => [columnWidth.value, mirrorStore.deviceWidth, mirrorStore.deviceHeight] as const,
  () => {
    if (mirrorStore.isOpen && !mirrorStore.isDetached && isLocalTarget.value) {
      void localViewport.apply();
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
  () => mirrorStore.webViewport,
  () => {
    if (!mirrorStore.isOpen || mirrorStore.isDetached) return;
    if (isLocalTarget.value) {
      void localViewport.syncAndApply();
      return;
    }
    if (mirrorStore.isStreaming && !androidMode.value) {
      void applyChromeViewportMode().catch((error) => {
        console.warn("Failed to update Chrome mirror viewport; restarting stream", error);
        void stopStream().then(() => startStream());
      });
    }
  },
);

const DETACHED_MIRROR_LABEL = "mirror-detached";
let detaching = false;

/**
 * Brings the screen back into the main window. This panel instance was unmounted when the screen
 * left, so it must not restart anything itself: the panel that mounts again starts its own stream,
 * and a second start from here would fight it for the device.
 */
function reattach(message?: string, description?: string) {
  mirrorStore.isDetached = false;
  if (message) toast.error(message, description ? { description } : undefined);
}

async function focusExistingDetachedMirror() {
  const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  const existing = await WebviewWindow.getByLabel(DETACHED_MIRROR_LABEL);
  if (!existing) return null;
  await existing.unminimize().catch((error: unknown) => {
    console.warn("Could not restore the minimized screen window", error);
  });
  await existing.show();
  await existing.setFocus();
  return existing;
}

async function handleDetach() {
  if (isLocalTarget.value) {
    toast.info("Local webview stays in the main window");
    return;
  }
  if (detaching) return;
  detaching = true;
  try {
    if (await focusExistingDetachedMirror()) {
      await stopStream();
      mirrorStore.isDetached = true;
      return;
    }

    await stopStream();
    mirrorStore.isDetached = true;

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
    const win = new WebviewWindow(DETACHED_MIRROR_LABEL, {
      url: "/?mirror=1",
      title: "Device Mirror",
      width: metrics.windowWidth,
      height: metrics.windowHeight,
      minWidth: 212,
      minHeight: 420,
      resizable: true,
      decorations: false,
      alwaysOnTop: mirrorStore.alwaysOnTop,
    });

    await Promise.all([
      win.once("tauri://destroyed", () => reattach()),
      win.once<string>("tauri://error", (event) => {
        reattach("Could not open the screen in its own window", String(event.payload));
      }),
    ]);
  } catch (error) {
    reattach("Could not open the screen in its own window", String(error));
  } finally {
    detaching = false;
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
    :style="{ width: `${columnWidth}px` }"
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
        @screenshot="captureScreenshot"
        @toggle-record="toggleRecord"
        @detach="handleDetach"
        @toggle-laser="mirrorStore.laserMode = !mirrorStore.laserMode"
        @toggle-side="mirrorStore.setSide(mirrorStore.side === 'right' ? 'left' : 'right')"
        @launch-scrcpy="launchExternalScrcpy"
        @refresh="handleRefresh"
      />

      <WebViewportBar
        v-if="!androidMode"
        :rendered-width="deviceFrameRef?.frame.screenWidth ?? 0"
      />

      <MirrorDeviceFrame
        ref="deviceFrameRef"
        :device-width="mirrorStore.deviceWidth"
        :device-height="mirrorStore.deviceHeight"
        :bare="isWebPreview"
        :class="androidMode ? '' : 'mb-2'"
      >
        <template #overlay>
          <MirrorBringToFront
            v-if="backgroundApp"
            :serial="backgroundApp.serial"
            :package-name="backgroundApp.packageName"
            :app-name="backgroundApp.appName"
          />
        </template>
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
