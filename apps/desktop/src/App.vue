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
import { drawerViewFor } from "@/types/drawer.types";

const searchParams = new URLSearchParams(window.location.search);
const isMirrorWindow = searchParams.get("mirror") === "1";
const isDrawerWindow =
  !isMirrorWindow && drawerViewFor(searchParams.get("drawer") ?? searchParams.get("dock")) !== null;
const themeStore = useThemeStore();
useNativeContextMenuGuard();

const MirrorWindow = isMirrorWindow
  ? defineAsyncComponent(() => import("@/modules/mirror/MirrorWindow.vue"))
  : null;

const DrawerWindow = isDrawerWindow
  ? defineAsyncComponent(() => import("@/components/drawer/DrawerWindow.vue"))
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

    <DrawerWindow v-else-if="isDrawerWindow && DrawerWindow" />

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
