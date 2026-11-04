<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  Minus,
  Maximize2,
  Minimize2,
  X,
  ScreenShare,
  Terminal,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useActiveContextStore } from "@/stores/activeContext.store";
import { useMirrorStore } from "@/stores/mirror.store";
import { useDockStore } from "@/stores/dock.store";
import { useUIStore } from "@/stores/ui.store";
import BrandMark from "@/components/brand/BrandMark.vue";
import KeyCaps from "@/components/command/KeyCaps.vue";
import { useBindingHint } from "@/composables/useBindingHint";
import ContextBar from "./ContextBar.vue";
import RecordingButton from "@/modules/recording/RecordingButton.vue";

const emit = defineEmits<{ openCommandPalette: [] }>();

const router = useRouter();
const context = useActiveContextStore();
const mirrorStore = useMirrorStore();
const dockStore = useDockStore();
const uiStore = useUIStore();
const { hint, keysOf } = useBindingHint();

const isMaximized = ref(false);
type AppWindowHandle = {
  isMaximized(): Promise<boolean>;
  onResized(handler: () => void): Promise<unknown>;
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
  close(): Promise<void>;
};
let appWindow: AppWindowHandle | null = null;

const mirrorEnabled = computed(
  () => context.device?.status === "online" || context.target !== null,
);

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const handle = getCurrentWebviewWindow() as unknown as AppWindowHandle;
    appWindow = handle;
    isMaximized.value = await handle.isMaximized();
    await handle.onResized(async () => {
      isMaximized.value = await handle.isMaximized();
    });
  } catch (error) {
    console.warn("Window controls unavailable", error);
    appWindow = null;
  }
});

async function minimize() {
  await appWindow?.minimize();
}

async function toggleMaximize() {
  if (!appWindow) return;
  if (isMaximized.value) {
    await appWindow.unmaximize();
    isMaximized.value = false;
  } else {
    await appWindow.maximize();
    isMaximized.value = true;
  }
}

async function close() {
  await appWindow?.close();
}

const iconButton =
  "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-[120ms] hover:bg-[var(--bg-surface-raised)] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]";
</script>

<template>
  <header
    class="relative flex h-10 shrink-0 select-none items-center border-b border-[var(--border-subtle)] bg-[var(--bg-chrome)] pl-2"
    style="-webkit-app-region: drag"
  >
    <div class="z-10 flex items-center gap-1" style="-webkit-app-region: no-drag">
      <button
        type="button"
        class="flex h-7 items-center gap-1.5 rounded-md px-1.5 text-foreground transition-colors duration-[120ms] hover:bg-[var(--bg-surface-raised)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        :title="hint('Toggle rail', 'view.toggle-rail')"
        aria-label="Toggle navigation rail"
        @click="uiStore.toggleSidebar()"
      >
        <BrandMark :size="16" />
        <span class="text-sm font-semibold tracking-tight">capubridge</span>
      </button>
      <span class="mx-1 h-4 w-px bg-[var(--border-default)]" />
      <button
        type="button"
        :class="iconButton"
        title="Back"
        aria-label="Back"
        @click="router.back()"
      >
        <ChevronLeft :size="15" />
      </button>
      <button
        type="button"
        :class="iconButton"
        title="Forward"
        aria-label="Forward"
        @click="router.forward()"
      >
        <ChevronRight :size="15" />
      </button>
    </div>

    <div
      class="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5"
      style="-webkit-app-region: no-drag"
    >
      <ContextBar />
      <RecordingButton />
    </div>

    <div class="z-10 ml-auto flex items-center gap-1" style="-webkit-app-region: no-drag">
      <button
        type="button"
        class="flex h-7 w-52 items-center gap-2 rounded-md bg-[var(--bg-surface-cut)] px-2 text-xs text-muted-foreground shadow-cut transition-colors duration-[120ms] hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        aria-label="Open command palette"
        @click="emit('openCommandPalette')"
      >
        <Search :size="13" class="shrink-0" />
        <span class="flex-1 text-left">Search or run…</span>
        <KeyCaps v-if="keysOf('view.palette')" :keys="keysOf('view.palette') ?? ''" />
      </button>

      <button
        type="button"
        class="relative"
        :class="[iconButton, dockStore.isOpen && 'bg-[var(--accent-soft)] text-signal-select']"
        :aria-pressed="dockStore.isOpen"
        :title="hint('Toggle console dock', 'view.toggle-dock')"
        aria-label="Toggle console dock"
        @click="dockStore.toggleDock()"
      >
        <Terminal :size="15" />
        <span
          v-if="dockStore.hasUnread && !dockStore.isOpen"
          class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-signal-select"
        />
      </button>

      <button
        type="button"
        class="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs transition-colors duration-[120ms] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--ring)]"
        :class="
          mirrorStore.isOpen
            ? 'bg-[var(--accent-soft)] text-signal-select'
            : mirrorEnabled
              ? 'text-muted-foreground hover:bg-[var(--bg-surface-raised)] hover:text-foreground'
              : 'cursor-not-allowed text-[var(--fg-subtle)] opacity-60'
        "
        :disabled="!mirrorEnabled"
        :aria-pressed="mirrorStore.isOpen"
        :title="
          !mirrorEnabled
            ? 'Connect a device or select a target to mirror'
            : mirrorStore.isOpen
              ? 'Close device pane'
              : 'Open device pane'
        "
        @click="mirrorEnabled && mirrorStore.toggle()"
      >
        <ScreenShare :size="14" />
        <span>Device</span>
        <span
          v-if="mirrorStore.isOpen && mirrorStore.isStreaming"
          class="h-1.5 w-1.5 rounded-full bg-signal-live"
        />
      </button>

      <div class="ml-1 flex items-center">
        <button
          type="button"
          class="flex h-10 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-foreground"
          aria-label="Minimize"
          @click="minimize"
        >
          <Minus :size="13" />
        </button>
        <button
          type="button"
          class="flex h-10 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-foreground"
          :aria-label="isMaximized ? 'Restore' : 'Maximize'"
          @click="toggleMaximize"
        >
          <Maximize2 v-if="!isMaximized" :size="11" />
          <Minimize2 v-else :size="11" />
        </button>
        <button
          type="button"
          class="flex h-10 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-error hover:text-[var(--bg-app)]"
          aria-label="Close"
          @click="close"
        >
          <X :size="13" />
        </button>
      </div>
    </div>
  </header>
</template>
