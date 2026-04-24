<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { useMirrorStore } from "@/stores/mirror.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useInspectStore } from "@/stores/inspect.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useSourceStore } from "@/stores/source.store";
import {
  restoreChromePort,
  restoreSelectedDeviceSerial,
} from "@/composables/useSessionPersistence";
import type { ADBDevice } from "@/types/adb.types";
import { AndroidKey, useMirrorStream } from "./useMirrorStream";
import {
  getDetachedMirrorLayoutMetrics,
  type DetachedMirrorLayoutMode,
} from "./detachedMirrorLayout";
import MirrorStream from "./MirrorStream.vue";
import MirrorSettingsPanel from "./MirrorSettingsPanel.vue";
import DetachedMirrorHeader from "./DetachedMirrorHeader.vue";
import DetachedMirrorTitleBar from "./DetachedMirrorTitleBar.vue";
import DetachedMirrorCompactRail from "./DetachedMirrorCompactRail.vue";

const mirrorStore = useMirrorStore();
const devicesStore = useDevicesStore();
const inspectStore = useInspectStore();
const targetsStore = useTargetsStore();
const sourceStore = useSourceStore();
const {
  useScrcpyCanvas,
  isAndroidStream,
  isConnected,
  startStream,
  stopStream,
  downloadScreenshot,
  sendKey,
  sendTouch,
  sendWheel,
  sendKeyboard,
  startRecording,
  stopRecording,
  setCanvasElement,
  applyChromeViewportMode,
} = useMirrorStream();

const settingsOpen = ref(false);
const immersiveMode = ref(false);
const detachedLayoutMode = ref<DetachedMirrorLayoutMode>("panel");
const isWindowMaximized = ref(false);
const streamAreaRef = ref<HTMLElement | null>(null);
const streamAreaSize = ref({ width: 0, height: 0 });
let appWindow: any = null;
let unlistenInspectMode: (() => void) | null = null;
let streamAreaObserver: ResizeObserver | null = null;

const deviceLabel = computed(() => {
  const model = devicesStore.selectedDevice?.model?.trim();
  if (model) return model;

  const serial = devicesStore.selectedDevice?.serial?.trim();
  if (serial) return serial;

  const title = targetsStore.selectedTarget?.title?.trim();
  if (title) return title;

  const packageName = targetsStore.selectedTarget?.packageName?.trim();
  if (packageName) return packageName;

  const url = targetsStore.selectedTarget?.url?.trim();
  if (url) {
    try {
      return new URL(url).host || url;
    } catch {
      return url;
    }
  }

  return "Mirror";
});

const detachedLayoutMetrics = computed(() =>
  getDetachedMirrorLayoutMetrics({
    preferredWidth: mirrorStore.preferredWidth,
    aspectRatio: mirrorStore.aspectRatio,
    availWidth: window.screen.availWidth,
    availHeight: window.screen.availHeight,
    mode: detachedLayoutMode.value,
    settingsOpen: settingsOpen.value && detachedLayoutMode.value === "large",
    isRecording: mirrorStore.isRecording && detachedLayoutMode.value === "large",
  }),
);
const screenBoundPhoneWidth = computed(() => {
  const aspectRatio = mirrorStore.aspectRatio || 9 / 19.5;
  if (streamAreaSize.value.width > 0 && streamAreaSize.value.height > 0) {
    return Math.max(
      1,
      Math.floor(Math.min(streamAreaSize.value.width, streamAreaSize.value.height * aspectRatio)),
    );
  }

  return detachedLayoutMetrics.value.phoneWidth;
});

function handleStreamNavigation(action: "back" | "home") {
  void sendKey(action === "back" ? AndroidKey.BACK : AndroidKey.HOME);
}

function syncStreamAreaSize() {
  const element = streamAreaRef.value;
  if (!element) {
    streamAreaSize.value = { width: 0, height: 0 };
    return;
  }

  const styles = window.getComputedStyle(element);
  const horizontalPadding =
    Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
  const verticalPadding =
    Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
  streamAreaSize.value = {
    width: Math.max(0, element.clientWidth - horizontalPadding),
    height: Math.max(0, element.clientHeight - verticalPadding),
  };
}

function pickStartupDevice(devices: ADBDevice[]) {
  const savedSerial = restoreSelectedDeviceSerial();
  if (savedSerial) {
    const savedDevice = devices.find((device) => device.serial === savedSerial);
    if (savedDevice) {
      return savedDevice;
    }
  }

  return devices.find((device) => device.status === "online") ?? null;
}

async function bootstrapRuntime() {
  try {
    await devicesStore.refreshDevices();
  } catch {}

  const startupDevice = devicesStore.selectedDevice ?? pickStartupDevice(devicesStore.devices);
  if (startupDevice && devicesStore.selectedDevice?.serial !== startupDevice.serial) {
    await devicesStore.selectDevice(startupDevice).catch(() => null);
  }

  if (!sourceStore.hasChromeSource) {
    const savedPort = restoreChromePort();
    const result = await sourceStore.autoConnectChrome().catch(() => null);
    if (result !== "connected" && savedPort) {
      await sourceStore.connectChrome(savedPort).catch(() => null);
    }
  }

  const adbSource = sourceStore.getAdbSource();
  if (adbSource) {
    await targetsStore.fetchTargetsForSource(adbSource).catch(() => null);
  }

  const chromeSource = sourceStore.getChromeSource();
  if (chromeSource) {
    await targetsStore.fetchTargetsForSource(chromeSource).catch(() => null);
  }
}

async function syncWindowChromeState() {
  try {
    isWindowMaximized.value = (await appWindow?.isMaximized()) ?? false;
  } catch {
    isWindowMaximized.value = false;
  }
}

async function setImmersiveMode(nextValue: boolean) {
  immersiveMode.value = nextValue;
  if (nextValue) {
    settingsOpen.value = false;
  }

  try {
    await appWindow?.setFullscreen(nextValue);
  } catch {}
}

async function syncDetachedWindowSize() {
  if (!appWindow) return;
  if (immersiveMode.value || isWindowMaximized.value) return;

  try {
    const { LogicalSize } = await import("@tauri-apps/api/dpi");
    const width = detachedLayoutMetrics.value.windowWidth;
    const height = detachedLayoutMetrics.value.windowHeight;
    await appWindow.setSize(new LogicalSize(width, height));
  } catch {}
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  if (!immersiveMode.value) return;
  event.preventDefault();
  void setImmersiveMode(false);
}

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    appWindow = getCurrentWebviewWindow();

    await syncWindowChromeState();
    if (mirrorStore.alwaysOnTop) {
      await appWindow.setAlwaysOnTop(true);
    }
    appWindow.onResized(() => {
      void syncWindowChromeState();
    });

    const { listen } = await import("@tauri-apps/api/event");
    unlistenInspectMode = await listen<{ enabled: boolean }>(
      "capubridge:set-inspect-mode",
      (event) => {
        inspectStore.inspectMode = event.payload.enabled;
        if (!event.payload.enabled) {
          inspectStore.clearMirrorHoverPoint();
        }
      },
    );
  } catch {}

  syncStreamAreaSize();
  if (typeof ResizeObserver !== "undefined") {
    streamAreaObserver = new ResizeObserver(() => {
      syncStreamAreaSize();
    });
    if (streamAreaRef.value) {
      streamAreaObserver.observe(streamAreaRef.value);
    }
  }
  window.addEventListener("keydown", handleWindowKeydown);
  window.addEventListener("resize", syncStreamAreaSize);
  await bootstrapRuntime();
  await nextTick();
  syncStreamAreaSize();
  await syncDetachedWindowSize();
  await startStream();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleWindowKeydown);
  window.removeEventListener("resize", syncStreamAreaSize);
  streamAreaObserver?.disconnect();
  streamAreaObserver = null;
  if (unlistenInspectMode) {
    unlistenInspectMode();
    unlistenInspectMode = null;
  }
  if (immersiveMode.value) {
    void setImmersiveMode(false);
  }
});

watch(
  () => devicesStore.selectedDevice?.serial,
  () => {
    if (mirrorStore.isDetached && mirrorStore.isStreaming) {
      void stopStream().then(() => startStream());
    }
  },
);

watch(
  () => targetsStore.selectedTarget?.id ?? null,
  () => {
    if (mirrorStore.isDetached && mirrorStore.isStreaming) {
      void stopStream().then(() => startStream());
    }
  },
);

watch(
  () =>
    [
      detachedLayoutMode.value,
      settingsOpen.value,
      immersiveMode.value,
      isWindowMaximized.value,
      mirrorStore.preferredWidth,
      mirrorStore.deviceWidth,
      mirrorStore.deviceHeight,
    ] as const,
  () => {
    void syncDetachedWindowSize();
  },
  { flush: "post" },
);

watch(
  () => mirrorStore.settings.fps,
  (next, prev) => {
    if (next === prev) return;
    if (mirrorStore.isDetached && mirrorStore.isStreaming) {
      void stopStream().then(() => startStream());
    }
  },
);

watch(
  () => mirrorStore.settings.chromeViewportMode,
  (next, prev) => {
    if (next === prev) return;
    if (mirrorStore.isDetached && mirrorStore.isStreaming && !isAndroidStream.value) {
      void applyChromeViewportMode().catch(() => {
        void stopStream().then(() => startStream());
      });
    }
  },
);

async function handleClose() {
  await setImmersiveMode(false);
  await stopStream();
  inspectStore.inspectMode = false;
  mirrorStore.isDetached = false;
  mirrorStore.close();
  try {
    await appWindow?.close();
  } catch {}
}

async function handleMinimize() {
  try {
    await appWindow?.minimize();
  } catch {}
}

async function handleMaximize() {
  try {
    const isMax = await appWindow?.isMaximized();
    if (isMax) await appWindow?.unmaximize();
    else await appWindow?.maximize();
    await syncWindowChromeState();
  } catch {}
}

async function handleToggleAlwaysOnTop() {
  mirrorStore.alwaysOnTop = !mirrorStore.alwaysOnTop;
  try {
    await appWindow?.setAlwaysOnTop(mirrorStore.alwaysOnTop);
  } catch {}
}

async function emitInspectEventToMain(event: string, payload?: { x: number; y: number }) {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const mainWindow = await WebviewWindow.getByLabel("main");
    if (!mainWindow) return;
    if (payload) await mainWindow.emit(event, payload);
    else await mainWindow.emit(event);
  } catch {}
}

function handleInspectHover(x: number, y: number) {
  if (!inspectStore.inspectMode) return;
  void emitInspectEventToMain("capubridge:inspect-hover", { x, y });
}

function handleInspectSelect(x: number, y: number) {
  if (!inspectStore.inspectMode) return;
  void emitInspectEventToMain("capubridge:inspect-select", { x, y });
  inspectStore.inspectMode = false;
}

function handleInspectLeave() {
  if (!inspectStore.inspectMode) return;
  void emitInspectEventToMain("capubridge:inspect-leave");
}

function toggleRecord() {
  if (mirrorStore.isRecording) void stopRecording();
  else void startRecording();
}
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-background dark select-none">
    <DetachedMirrorHeader
      v-if="!immersiveMode && detachedLayoutMode === 'large'"
      :device-label="deviceLabel"
      :is-recording="mirrorStore.isRecording"
      :laser-mode="mirrorStore.laserMode"
      :always-on-top="mirrorStore.alwaysOnTop"
      :is-streaming="mirrorStore.isStreaming"
      :settings-open="settingsOpen"
      :android-mode="isAndroidStream"
      :is-window-maximized="isWindowMaximized"
      @screenshot="downloadScreenshot"
      @toggle-record="toggleRecord"
      @toggle-laser="mirrorStore.laserMode = !mirrorStore.laserMode"
      @toggle-always-on-top="handleToggleAlwaysOnTop"
      @update:settings-open="settingsOpen = $event"
      @minimize-window="handleMinimize"
      @toggle-window-maximize="handleMaximize"
      @close-window="handleClose"
    />

    <DetachedMirrorTitleBar
      v-else-if="!immersiveMode"
      :device-label="deviceLabel"
      :always-on-top="mirrorStore.alwaysOnTop"
      :is-window-maximized="isWindowMaximized"
      @toggle-always-on-top="handleToggleAlwaysOnTop"
      @minimize-window="handleMinimize"
      @toggle-window-maximize="handleMaximize"
      @close-window="handleClose"
    />

    <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 max-h-0"
        leave-to-class="opacity-0 max-h-0"
      >
        <div
          v-if="settingsOpen && !immersiveMode && detachedLayoutMode === 'large'"
          class="overflow-hidden border-b border-border/30 bg-background/94 backdrop-blur-md"
          style="-webkit-app-region: no-drag"
        >
          <MirrorSettingsPanel :android-mode="isAndroidStream" />
        </div>
      </Transition>

      <div
        ref="streamAreaRef"
        class="relative flex flex-1 items-center justify-center bg-zinc-950"
        :class="
          immersiveMode ? 'p-0' : detachedLayoutMode === 'panel' ? 'pl-14 pr-2 pb-2 pt-1' : 'p-3'
        "
        style="-webkit-app-region: no-drag"
      >
        <div
          class="max-w-full overflow-hidden shadow-2xl ring-1 ring-white/5"
          :class="immersiveMode ? 'rounded-none' : 'rounded-[0.75rem]'"
          :style="{
            width: `${screenBoundPhoneWidth}px`,
            maxHeight: '100%',
            aspectRatio: `${mirrorStore.deviceWidth || 9} / ${mirrorStore.deviceHeight || 19.5}`,
          }"
        >
          <MirrorStream
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
          />
        </div>

        <Transition
          enter-active-class="transition-all duration-300"
          leave-active-class="transition-all duration-200"
          enter-from-class="opacity-0 translate-y-2"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div
            v-if="mirrorStore.isRecording && !immersiveMode && detachedLayoutMode === 'large'"
            class="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-red-400/25 bg-background/86 px-3 py-1.5 text-[10px] font-medium tracking-[0.24em] text-red-400 backdrop-blur-md"
          >
            <div class="h-1.5 w-1.5 rounded-full bg-red-400 animate-pulse" />
            REC
          </div>
        </Transition>

        <Transition
          enter-active-class="transition-all duration-300"
          leave-active-class="transition-all duration-200"
          enter-from-class="opacity-0 translate-y-2"
          leave-to-class="opacity-0 translate-y-2"
        >
          <div
            v-if="immersiveMode"
            class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-border/25 bg-background/74 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-muted-foreground/72 backdrop-blur-md"
          >
            Esc to exit
          </div>
        </Transition>

        <DetachedMirrorCompactRail
          v-if="!immersiveMode && detachedLayoutMode === 'panel'"
          :is-recording="mirrorStore.isRecording"
          :laser-mode="mirrorStore.laserMode"
          :is-streaming="mirrorStore.isStreaming"
          :settings-open="settingsOpen"
          :android-mode="isAndroidStream"
          @screenshot="downloadScreenshot"
          @toggle-record="toggleRecord"
          @toggle-laser="mirrorStore.laserMode = !mirrorStore.laserMode"
          @update:settings-open="settingsOpen = $event"
          @keyevent="sendKey"
        />
      </div>
    </div>
  </div>
</template>
