<script setup lang="ts">
import { PanelBottomOpen } from "lucide-vue-next";
import AppToasts from "@/components/feedback/AppToasts.vue";
import WindowControls from "@/components/layout/WindowControls.vue";
import { useDrawerWindowCapture } from "@/composables/useDrawerWindowCapture";
import { emitEvent } from "@/runtime/ipc/client";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import { provideDrawerHost, provideDrawerToolbarSlot } from "@/shared/drawer/toolbarSlot";
import { useDrawerStore } from "@/stores/drawer.store";
import { drawerViewFor, drawerViewIds } from "@/types/drawer.types";
import DrawerBody from "./DrawerBody.vue";
import DrawerViewSwitch from "./DrawerViewSwitch.vue";

/**
 * The console drawer in a window of its own: Logs and Console together, the same switch,
 * gates and controls as in the drawer, a caption that drags the window, and a way back to the
 * drawer. Capture stays app-level in the main window; this window only joins it.
 */
const params = new URLSearchParams(window.location.search);
const initial = drawerViewFor(params.get("drawer") ?? params.get("dock"))?.view ?? "logs";

const drawer = useDrawerStore();
drawer.setView(initial);
const toolbarSlot = provideDrawerToolbarSlot();

function bindToolbar(element: unknown) {
  toolbarSlot.value = element instanceof HTMLElement ? element : null;
}
provideDrawerHost("window");
useDrawerWindowCapture(drawerViewIds);

async function closeWindow() {
  const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
  await getCurrentWebviewWindow().close();
}

async function returnToDrawer() {
  try {
    await emitEvent("capubridge:drawer-return", { view: drawer.currentView });
    await closeWindow();
  } catch (error) {
    console.error("[drawer] could not return to the drawer", error);
  }
}
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden bg-background">
    <header
      class="flex h-10 shrink-0 items-center gap-2 border-b border-border-subtle pl-2"
      style="-webkit-app-region: drag"
      data-tauri-drag-region
    >
      <span style="-webkit-app-region: no-drag">
        <DrawerViewSwitch />
      </span>
      <div
        :ref="bindToolbar"
        class="flex min-w-0 flex-1 items-center"
        style="-webkit-app-region: no-drag"
      />
      <span class="flex h-full shrink-0 items-center" style="-webkit-app-region: no-drag">
        <IconAction label="Put back in the drawer" class="mr-1" @click="returnToDrawer">
          <PanelBottomOpen :stroke-width="1.8" />
        </IconAction>
        <WindowControls size="sm" />
      </span>
    </header>
    <DrawerBody :views="drawerViewIds" :current="drawer.currentView" />
    <AppToasts />
  </div>
</template>
