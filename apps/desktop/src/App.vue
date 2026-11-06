<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import UpdaterBootstrap from "@/components/UpdaterBootstrap.vue";
import McpBridgeBootstrap from "@/components/McpBridgeBootstrap.vue";
import ObservabilityBootstrap from "@/components/ObservabilityBootstrap.vue";
import { CladdProvider } from "@capubridge/cladd";
import { Toaster } from "@/components/ui/sonner";
import { useThemeStore } from "@/stores/theme.store";
import { useNativeContextMenuGuard } from "@/composables/useNativeContextMenuGuard";
import { isDockTab } from "@/types/dock.types";

const searchParams = new URLSearchParams(window.location.search);
const isMirrorWindow = searchParams.get("mirror") === "1";
const isDockWindow = !isMirrorWindow && isDockTab(searchParams.get("dock"));
const themeStore = useThemeStore();
useNativeContextMenuGuard();

const MirrorWindow = isMirrorWindow
  ? defineAsyncComponent(() => import("@/modules/mirror/MirrorWindow.vue"))
  : null;

const DockDetachedWindow = isDockWindow
  ? defineAsyncComponent(() => import("@/components/dock/DockDetachedWindow.vue"))
  : null;
</script>

<template>
  <CladdProvider accent-color="brand" :theme="themeStore.mode" overlays-root="body">
    <template v-if="isMirrorWindow && MirrorWindow">
      <MirrorWindow />
      <Toaster
        class="mirror-toaster"
        position="bottom-center"
        :theme="themeStore.mode"
        :visible-toasts="3"
        :duration="4000"
      />
    </template>

    <DockDetachedWindow v-else-if="isDockWindow && DockDetachedWindow" />

    <template v-else>
      <AppShell />
      <UpdaterBootstrap />
      <McpBridgeBootstrap />
      <ObservabilityBootstrap />
      <Toaster
        position="bottom-left"
        :theme="themeStore.mode"
        :rich-colors="true"
        :visible-toasts="5"
        :duration="4000"
      />
    </template>
  </CladdProvider>
</template>
