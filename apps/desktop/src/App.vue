<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import { Toaster } from "@/components/ui/sonner";
import { useUIStore } from "@/stores/ui.store";
import { isDockTab } from "@/types/dock.types";

const searchParams = new URLSearchParams(window.location.search);
const isMirrorWindow = searchParams.get("mirror") === "1";
const isDockWindow = !isMirrorWindow && isDockTab(searchParams.get("dock"));
const uiStore = useUIStore();

const MirrorWindow = isMirrorWindow
  ? defineAsyncComponent(() => import("@/modules/mirror/MirrorWindow.vue"))
  : null;

const DockDetachedWindow = isDockWindow
  ? defineAsyncComponent(() => import("@/components/dock/DockDetachedWindow.vue"))
  : null;
</script>

<template>
  <MirrorWindow v-if="isMirrorWindow && MirrorWindow" />

  <DockDetachedWindow v-else-if="isDockWindow && DockDetachedWindow" />

  <template v-else>
    <AppShell />
    <Toaster
      position="bottom-left"
      :theme="uiStore.resolvedTheme"
      :rich-colors="true"
      :visible-toasts="5"
      :duration="4000"
    />
  </template>
</template>
