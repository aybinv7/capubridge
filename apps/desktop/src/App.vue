<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import UpdaterBootstrap from "@/components/UpdaterBootstrap.vue";
import McpBridgeBootstrap from "@/components/McpBridgeBootstrap.vue";
import ObservabilityBootstrap from "@/components/ObservabilityBootstrap.vue";
import WirelessReconnectBootstrap from "@/components/WirelessReconnectBootstrap.vue";
import { CladdProvider } from "@capubridge/cladd";
import AppToasts from "@/components/feedback/AppToasts.vue";
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
      <AppToasts />
    </template>

    <DrawerWindow v-else-if="isDrawerWindow && DrawerWindow" />

    <template v-else>
      <AppShell />
      <UpdaterBootstrap />
      <McpBridgeBootstrap />
      <ObservabilityBootstrap />
      <WirelessReconnectBootstrap />
      <AppToasts />
    </template>
  </CladdProvider>
</template>
