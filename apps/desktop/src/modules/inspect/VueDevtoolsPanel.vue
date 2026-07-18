<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useVueDevtoolsBridge } from "./vue-devtools/useVueDevtoolsBridge";
import { useCDP } from "@/composables/useCDP";

const iframeRef = ref<HTMLIFrameElement | null>(null);

const { attachIframe, start, frameHtml, errorMessage, statusLabel, isReady } =
  useVueDevtoolsBridge();
const { targetsStore } = useCDP();

async function boot() {
  if (iframeRef.value) {
    await attachIframe(iframeRef.value);
  }

  try {
    await start();
  } catch (error) {
    console.warn("Failed to start Vue DevTools bridge", error);
  }
}

watch(
  iframeRef,
  (iframe) => {
    void attachIframe(iframe);
  },
  { immediate: true },
);

watch(
  () => targetsStore.selectedTarget?.id ?? null,
  () => {
    void boot();
  },
);

onMounted(() => {
  void boot();
});
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-surface-0">
    <iframe
      ref="iframeRef"
      :srcdoc="frameHtml"
      class="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin"
      title="Vue DevTools"
    />

    <div
      v-if="!isReady"
      class="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-0/82 backdrop-blur-sm"
    >
      <div class="max-w-md rounded-2xl border border-border/40 bg-surface-2 px-5 py-4 text-center">
        <div class="text-sm font-medium text-foreground">
          {{ statusLabel }}
        </div>
        <div class="mt-2 text-sm text-muted-foreground/80">
          Target page reloads once so official Vue DevTools can hook before app boot.
        </div>
        <div v-if="errorMessage" class="mt-3 text-sm text-red-400">
          {{ errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>
