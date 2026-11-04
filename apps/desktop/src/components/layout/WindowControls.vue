<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { Maximize2, Minimize2, Minus, X } from "lucide-vue-next";

type AppWindowHandle = {
  isMaximized(): Promise<boolean>;
  onResized(handler: () => void): Promise<() => void>;
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  close(): Promise<void>;
};

const isMaximized = ref(false);
let appWindow: AppWindowHandle | null = null;
let stopResizeListener: (() => void) | null = null;

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const handle = getCurrentWebviewWindow() as unknown as AppWindowHandle;
    appWindow = handle;
    isMaximized.value = await handle.isMaximized();
    stopResizeListener = await handle.onResized(async () => {
      isMaximized.value = await handle.isMaximized();
    });
  } catch (error) {
    console.warn("Window controls unavailable", error);
    appWindow = null;
  }
});

onUnmounted(() => {
  stopResizeListener?.();
  stopResizeListener = null;
});

async function run(action: () => Promise<void>, label: string) {
  try {
    await action();
  } catch (error) {
    console.warn(`Failed to ${label} the window`, error);
  }
}

function minimize() {
  if (appWindow) void run(() => appWindow?.minimize() ?? Promise.resolve(), "minimize");
}

function toggleMaximize() {
  const handle = appWindow;
  if (!handle) return;
  void run(async () => {
    if (isMaximized.value) await handle.unmaximize();
    else await handle.maximize();
    isMaximized.value = !isMaximized.value;
  }, "resize");
}

function close() {
  if (appWindow) void run(() => appWindow?.close() ?? Promise.resolve(), "close");
}

const base =
  "flex h-11.5 w-11 items-center justify-center text-[var(--fg-subtle)] transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--ring)]";
const control = `${base} hover:bg-[var(--bg-surface-raised)] hover:text-foreground`;
const closeControl = `${base} hover:bg-error hover:text-[var(--bg-app)]`;
</script>

<template>
  <div class="flex items-center" style="-webkit-app-region: no-drag">
    <button type="button" :class="control" aria-label="Minimize" @click="minimize">
      <Minus :size="13" />
    </button>
    <button
      type="button"
      :class="control"
      :aria-label="isMaximized ? 'Restore' : 'Maximize'"
      @click="toggleMaximize"
    >
      <Maximize2 v-if="!isMaximized" :size="11" />
      <Minimize2 v-else :size="11" />
    </button>
    <button type="button" :class="closeControl" aria-label="Close" @click="close">
      <X :size="13" />
    </button>
  </div>
</template>
