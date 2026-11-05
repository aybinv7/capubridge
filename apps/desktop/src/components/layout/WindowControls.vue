<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import WindowCaptionGlyph from "./WindowCaptionGlyph.vue";

/**
 * The minimize, maximize and close buttons of a frameless window, drawn the way Windows draws
 * them: 46 px wide, flush with the top-right corner, a red close. `close` replaces the plain
 * window close when the window has to clean up first.
 */
const props = withDefaults(
  defineProps<{ size?: "md" | "sm"; close?: () => Promise<void> | void }>(),
  { size: "md", close: undefined },
);

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
      isMaximized.value = await handle.isMaximized().catch(() => isMaximized.value);
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

async function run(action: () => Promise<void> | void, label: string) {
  try {
    await action();
  } catch (error) {
    console.warn(`Failed to ${label} the window`, error);
  }
}

function minimize() {
  const handle = appWindow;
  if (handle) void run(() => handle.minimize(), "minimize");
}

function toggleMaximize() {
  const handle = appWindow;
  if (!handle) return;
  void run(async () => {
    if (isMaximized.value) await handle.unmaximize();
    else await handle.maximize();
    isMaximized.value = await handle.isMaximized();
  }, "resize");
}

function close() {
  const action = props.close;
  if (action) {
    void run(action, "close");
    return;
  }
  const handle = appWindow;
  if (handle) void run(() => handle.close(), "close");
}

const base =
  "flex w-11.5 items-center justify-center text-muted-foreground transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--ring)]";
const heightClass = props.size === "sm" ? "h-9" : "h-11.5";
const control = `${base} ${heightClass} hover:bg-[var(--bg-surface-raised)] hover:text-foreground active:bg-[var(--bg-surface)]`;
const closeControl = `${base} ${heightClass} hover:bg-window-close hover:text-white active:bg-window-close/90 active:text-white`;
</script>

<template>
  <div class="flex shrink-0 items-start self-start" style="-webkit-app-region: no-drag">
    <button type="button" :class="control" aria-label="Minimize" title="Minimize" @click="minimize">
      <WindowCaptionGlyph name="minimize" />
    </button>
    <button
      type="button"
      :class="control"
      :aria-label="isMaximized ? 'Restore' : 'Maximize'"
      :title="isMaximized ? 'Restore' : 'Maximize'"
      @click="toggleMaximize"
    >
      <WindowCaptionGlyph :name="isMaximized ? 'restore' : 'maximize'" />
    </button>
    <button type="button" :class="closeControl" aria-label="Close" title="Close" @click="close">
      <WindowCaptionGlyph name="close" />
    </button>
  </div>
</template>
