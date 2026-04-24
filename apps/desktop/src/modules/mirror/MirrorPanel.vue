<script setup lang="ts">
import { ref, watch } from "vue";
import { toast } from "vue-sonner";
import { useMirrorStore } from "@/stores/mirror.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useInspectStore } from "@/stores/inspect.store";
import { useTargetsStore } from "@/stores/targets.store";
import { useMirrorViewportWidth } from "./useMirrorViewportWidth";
import { AndroidKey, useMirrorStream } from "./useMirrorStream";
import { getDetachedMirrorLayoutMetrics } from "./detachedMirrorLayout";
import MirrorStream from "./MirrorStream.vue";
import MirrorControls from "./MirrorControls.vue";
import MirrorTopBar from "./MirrorTopBar.vue";
import MirrorSettingsPanel from "./MirrorSettingsPanel.vue";

const mirrorStore = useMirrorStore();
const devicesStore = useDevicesStore();
const inspectStore = useInspectStore();
const targetsStore = useTargetsStore();
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
  launchExternalScrcpy,
  setCanvasElement,
  applyChromeViewportMode,
} = useMirrorStream();

const settingsOpen = ref(false);
const isResizing = ref(false);
const streamAreaRef = ref<HTMLElement | null>(null);
const { panelWidth } = useMirrorViewportWidth(streamAreaRef);

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

watch(
  () => mirrorStore.isOpen,
  (open) => {
    if (open && !mirrorStore.isDetached) {
      void startStream();
    } else if (!open) {
      void stopStream();
    }
  },

  { immediate: true },
);

watch(
  () => devicesStore.selectedDevice?.serial,
  () => {
    if (mirrorStore.isOpen && !mirrorStore.isDetached) {
      void stopStream().then(() => startStream());
    }
  },
);

watch(
  () => targetsStore.selectedTarget?.id ?? null,
  () => {
    if (mirrorStore.isOpen && !mirrorStore.isDetached) {
      void stopStream().then(() => startStream());
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
      !isAndroidStream.value
    ) {
      void applyChromeViewportMode().catch(() => {
        void stopStream().then(() => startStream());
      });
    }
  },
);

async function handleDetach() {
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

    win.once("tauri://destroyed", () => {
      mirrorStore.isDetached = false;
      if (mirrorStore.isOpen) void startStream();
    });

    win.once("tauri://error", () => {
      mirrorStore.isDetached = false;
      toast.error("Failed to open mirror window");
      void startStream();
    });
  } catch (e) {
    mirrorStore.isDetached = false;
    toast.error("Failed to detach mirror", { description: String(e) });
    void startStream();
  }
}

async function handleToggleAlwaysOnTop() {
  mirrorStore.alwaysOnTop = !mirrorStore.alwaysOnTop;
}

async function handleMaximize() {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const win = getCurrentWebviewWindow();
    const isMax = await win.isMaximized();
    if (isMax) win.unmaximize();
    else win.maximize();
  } catch {}
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
  <div class="flex shrink-0 h-full" :style="{ width: `${panelWidth + 4}px` }">
    <div
      v-if="mirrorStore.side === 'right'"
      class="w-1 cursor-col-resize group shrink-0 flex items-center justify-center hover:bg-border/60 transition-colors"
      :class="isResizing ? 'bg-border' : ''"
      @mousedown.prevent="startResize"
    >
      <div class="w-px h-8 bg-border/40 group-hover:bg-border transition-colors" />
    </div>

    <div
      class="flex-1 flex flex-col overflow-hidden border-border/20 bg-background"
      :class="mirrorStore.side === 'right' ? 'border-l' : 'border-r'"
    >
      <MirrorTopBar
        :is-recording="mirrorStore.isRecording"
        :laser-mode="mirrorStore.laserMode"
        :always-on-top="mirrorStore.alwaysOnTop"
        :side="mirrorStore.side"
        :is-detached="false"
        :is-streaming="mirrorStore.isStreaming"
        :settings-open="settingsOpen"
        :android-mode="isAndroidStream"
        @screenshot="downloadScreenshot"
        @toggle-record="toggleRecord"
        @toggle-laser="mirrorStore.laserMode = !mirrorStore.laserMode"
        @toggle-always-on-top="handleToggleAlwaysOnTop"
        @toggle-side="mirrorStore.setSide(mirrorStore.side === 'right' ? 'left' : 'right')"
        @toggle-detach="handleDetach"
        @launch-scrcpy="launchExternalScrcpy"
        @maximize="handleMaximize"
        @update:settings-open="settingsOpen = $event"
      />

      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        leave-active-class="transition-all duration-150 ease-in"
        enter-from-class="opacity-0 max-h-0"
        leave-to-class="opacity-0 max-h-0"
      >
        <div v-if="settingsOpen" class="overflow-hidden border-b border-border/30 max-h-48">
          <MirrorSettingsPanel :android-mode="isAndroidStream" />
        </div>
      </Transition>

      <div
        ref="streamAreaRef"
        class="flex-1 overflow-hidden flex items-center justify-center p-2 bg-zinc-950"
      >
        <div
          class="w-full overflow-hidden rounded-lg shadow-2xl ring-1 ring-white/5"
          :style="{
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
      </div>

      <MirrorControls v-if="isAndroidStream" @keyevent="sendKey" />

      <Transition
        enter-active-class="transition-all duration-300"
        leave-active-class="transition-all duration-200"
        enter-from-class="opacity-0 translate-y-1"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div
          v-if="mirrorStore.isRecording"
          class="h-5 bg-red-500/10 border-t border-red-500/20 flex items-center justify-center gap-1.5 shrink-0"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span class="text-[10px] text-red-400 font-medium tracking-wide">RECORDING</span>
        </div>
      </Transition>
    </div>

    <div
      v-if="mirrorStore.side === 'left'"
      class="w-1 cursor-col-resize group shrink-0 flex items-center justify-center hover:bg-border/60 transition-colors"
      :class="isResizing ? 'bg-border' : ''"
      @mousedown.prevent="startResize"
    >
      <div class="w-px h-8 bg-border/40 group-hover:bg-border transition-colors" />
    </div>
  </div>
</template>
