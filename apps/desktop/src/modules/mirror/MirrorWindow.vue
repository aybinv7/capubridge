<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { X, Minus } from "lucide-vue-next";
import { useMirrorStore } from "@/stores/mirror.store";
import { useDevicesStore } from "@/stores/devices.store";
import { useInspectStore } from "@/stores/inspect.store";
import { useMirrorStream } from "./useMirrorStream";
import MirrorStream from "./MirrorStream.vue";
import MirrorControls from "./MirrorControls.vue";
import MirrorTopBar from "./MirrorTopBar.vue";
import MirrorSettingsPanel from "./MirrorSettingsPanel.vue";

const mirrorStore = useMirrorStore();
const devicesStore = useDevicesStore();
const inspectStore = useInspectStore();
const {
  useScrcpyCanvas,
  isConnected,
  startStream,
  stopStream,
  downloadScreenshot,
  sendKey,
  sendTouch,
  startRecording,
  stopRecording,
  launchExternalScrcpy,
  setCanvasElement,
} = useMirrorStream();

const settingsOpen = ref(false);
let appWindow: any = null;
let unlistenInspectMode: (() => void) | null = null;

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    appWindow = getCurrentWebviewWindow();

    if (mirrorStore.alwaysOnTop) {
      await appWindow.setAlwaysOnTop(true);
    }

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

  // Start the stream in detached mode
  await startStream();
});

onUnmounted(() => {
  if (unlistenInspectMode) {
    unlistenInspectMode();
    unlistenInspectMode = null;
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
  () => mirrorStore.settings.fps,
  (next, prev) => {
    if (next === prev) return;
    if (mirrorStore.isDetached && mirrorStore.isStreaming) {
      void stopStream().then(() => startStream());
    }
  },
);

async function handleClose() {
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
  <div
    class="flex flex-col h-screen overflow-hidden bg-background dark select-none"
    style="-webkit-app-region: drag"
  >
    <!-- Custom title bar -->
    <div class="h-8 flex items-center px-2 border-b border-border/30 bg-background shrink-0">
      <span class="text-xs text-muted-foreground/60 ml-1 flex-1">Device Mirror</span>
      <div class="flex items-center" style="-webkit-app-region: no-drag">
        <button
          class="w-7 h-7 flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-accent rounded transition-colors"
          @click="handleMinimize"
        >
          <Minus class="w-3 h-3" />
        </button>
        <button
          class="w-7 h-7 flex items-center justify-center text-muted-foreground/50 hover:text-[#981515] hover:bg-[#981515]/10 rounded transition-colors"
          @click="handleClose"
        >
          <X class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Mirror action bar -->
    <div style="-webkit-app-region: no-drag">
      <MirrorTopBar
        :is-recording="mirrorStore.isRecording"
        :laser-mode="mirrorStore.laserMode"
        :always-on-top="mirrorStore.alwaysOnTop"
        :side="mirrorStore.side"
        :is-detached="true"
        :is-streaming="mirrorStore.isStreaming"
        :settings-open="settingsOpen"
        @screenshot="downloadScreenshot"
        @toggle-record="toggleRecord"
        @toggle-laser="mirrorStore.laserMode = !mirrorStore.laserMode"
        @toggle-always-on-top="handleToggleAlwaysOnTop"
        @toggle-side="mirrorStore.setSide(mirrorStore.side === 'right' ? 'left' : 'right')"
        @toggle-detach="handleClose"
        @launch-scrcpy="launchExternalScrcpy"
        @maximize="handleMaximize"
        @update:settings-open="settingsOpen = $event"
      />
    </div>

    <!-- Settings panel (inline collapsible) -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 max-h-0"
      leave-to-class="opacity-0 max-h-0"
    >
      <div
        v-if="settingsOpen"
        class="overflow-hidden border-b border-border/30 max-h-48"
        style="-webkit-app-region: no-drag"
      >
        <MirrorSettingsPanel />
      </div>
    </Transition>

    <!-- Stream area -->
    <div
      class="flex-1 overflow-hidden flex items-center justify-center bg-zinc-950 p-2"
      style="-webkit-app-region: no-drag"
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
          @inspect-hover="handleInspectHover"
          @inspect-select="handleInspectSelect"
          @inspect-leave="handleInspectLeave"
          @canvas-ready="setCanvasElement"
        />
      </div>
    </div>

    <!-- Device buttons -->
    <div style="-webkit-app-region: no-drag">
      <MirrorControls @keyevent="sendKey" />
    </div>

    <!-- Recording strip -->
    <Transition
      enter-active-class="transition-all duration-300"
      leave-active-class="transition-all duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="mirrorStore.isRecording"
        class="h-5 bg-red-500/10 border-t border-red-500/20 flex items-center justify-center gap-1.5 shrink-0"
        style="-webkit-app-region: no-drag"
      >
        <div class="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span class="text-[10px] text-red-400 font-medium tracking-wide">RECORDING</span>
      </div>
    </Transition>
  </div>
</template>
