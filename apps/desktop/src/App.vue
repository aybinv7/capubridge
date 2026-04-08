<script setup lang="ts">
import { defineAsyncComponent } from "vue";
import AppShell from "@/components/layout/AppShell.vue";
import { Toaster } from "@/components/ui/sonner";

// Detect if this window is the detached mirror window (opened via ?mirror=1)
const isMirrorWindow = new URLSearchParams(window.location.search).get("mirror") === "1";

const MirrorWindow = isMirrorWindow
  ? defineAsyncComponent(() => import("@/modules/mirror/MirrorWindow.vue"))
  : null;
</script>

<template>
  <MirrorWindow v-if="isMirrorWindow && MirrorWindow" />

  <template v-else-if="!isMirrorWindow">
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
