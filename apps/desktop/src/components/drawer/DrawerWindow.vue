<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { Maximize2, Minimize2, Minus, PanelBottomOpen, X } from "lucide-vue-next";
import { Toaster } from "@/components/ui/sonner";
import { useDrawerWindowCapture } from "@/composables/useDrawerWindowCapture";
import { emitEvent } from "@/runtime/ipc/client";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { provideDrawerHost, provideDrawerToolbarSlot } from "@/shared/drawer/toolbarSlot";
import { useThemeStore } from "@/stores/theme.store";
import { drawerViewFor } from "@/types/drawer.types";
import DrawerBody from "./DrawerBody.vue";
import { DRAWER_VIEW_META } from "./drawerViews";

/**
 * A drawer view in a window of its own: the same view and gate as in the drawer, a caption
 * that is a drag region, and a way back to the drawer. Capture stays app-level in the main
 * window; this window only joins it.
 */
const params = new URLSearchParams(window.location.search);
const view = drawerViewFor(params.get("drawer") ?? params.get("dock"))?.view ?? "logs";
const meta = DRAWER_VIEW_META[view];
const views = [view] as const;

const themeStore = useThemeStore();
const toolbarSlot = provideDrawerToolbarSlot();

function bindToolbar(element: unknown) {
  toolbarSlot.value = element instanceof HTMLElement ? element : null;
}
provideDrawerHost("window");
useDrawerWindowCapture(view);

const isMaximized = ref(false);
let appWindow: Awaited<
  ReturnType<typeof import("@tauri-apps/api/webviewWindow").getCurrentWebviewWindow>
> | null = null;
let stopResized: (() => void) | null = null;

onMounted(async () => {
  try {
    const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    appWindow = getCurrentWebviewWindow();
    isMaximized.value = await appWindow.isMaximized();
    stopResized = await appWindow.onResized(async () => {
      isMaximized.value = (await appWindow?.isMaximized()) ?? false;
    });
  } catch (error) {
    appWindow = null;
    console.error("[drawer] window controls are unavailable in this window", error);
  }
});

onUnmounted(() => {
  stopResized?.();
  stopResized = null;
});

async function act(action: () => Promise<void> | undefined, what: string) {
  try {
    await action();
  } catch (error) {
    console.error(`[drawer] could not ${what}`, error);
  }
}

async function toggleMaximize() {
  if (!appWindow) return;
  if (isMaximized.value) await appWindow.unmaximize();
  else await appWindow.maximize();
  isMaximized.value = !isMaximized.value;
}

async function returnToDrawer() {
  await emitEvent("capubridge:drawer-return", { view });
  await appWindow?.close();
}
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-background">
    <header
      class="flex min-h-10 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border-subtle py-1 pr-1 pl-3"
      style="-webkit-app-region: drag"
    >
      <span class="flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground">
        <component :is="meta.icon" class="size-4 text-muted-foreground" aria-hidden="true" />
        {{ meta.label }}
      </span>
      <div
        :ref="bindToolbar"
        class="flex min-w-0 flex-1 items-center"
        style="-webkit-app-region: no-drag"
      />
      <span class="flex shrink-0 items-center gap-0.5" style="-webkit-app-region: no-drag">
        <IconAction
          :label="`Put ${meta.label} back in the drawer`"
          @click="act(returnToDrawer, 'return to the drawer')"
        >
          <PanelBottomOpen :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Minimise" @click="act(() => appWindow?.minimize(), 'minimise')">
          <Minus :stroke-width="1.8" />
        </IconAction>
        <IconAction
          :label="isMaximized ? 'Restore' : 'Maximise'"
          @click="act(toggleMaximize, 'resize the window')"
        >
          <Minimize2 v-if="isMaximized" :stroke-width="1.8" />
          <Maximize2 v-else :stroke-width="1.8" />
        </IconAction>
        <IconAction label="Close" @click="act(() => appWindow?.close(), 'close the window')">
          <X :stroke-width="1.8" />
        </IconAction>
      </span>
    </header>
    <DrawerBody :views="views" :current="view" />
    <Toaster position="bottom-left" :theme="themeStore.mode" :visible-toasts="3" :duration="4000" />
  </div>
</template>
