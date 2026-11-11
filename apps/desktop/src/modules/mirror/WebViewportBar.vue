<script setup lang="ts">
import type { ViewportArea } from "@/lib/web-viewport";
import WebViewportControls from "./WebViewportControls.vue";

/** The page-size row above a Chrome tab's screen. Pages on This PC carry it in their toolbar. */
const props = defineProps<{ renderedWidth: number; area: ViewportArea | null }>();
</script>

<template>
  <div
    class="@container mx-2 mb-1.5 flex h-8 shrink-0 items-center rounded-control bg-surface-2 pr-1 pl-0.5 shadow-bevel"
    role="toolbar"
    aria-label="Viewport"
  >
    <WebViewportControls
      :rendered-width="props.renderedWidth"
      :area="props.area"
      class="w-full justify-between"
    />
  </div>
</template>
