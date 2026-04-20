<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import { Toaster } from "@/components/ui/sonner";
import { isDockTab } from "@/types/dock.types";

const searchParams = new URLSearchParams(window.location.search);
const isMirrorWindow = searchParams.get("mirror") === "1";
const isDockWindow = !isMirrorWindow && isDockTab(searchParams.get("dock"));

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
      position="bottom-right"
      theme="dark"
      :rich-colors="true"
      :visible-toasts="5"
      :duration="4000"
    />
  </template>
</template>
