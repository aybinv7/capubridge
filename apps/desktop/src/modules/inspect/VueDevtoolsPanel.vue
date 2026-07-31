<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { AlertTriangle, RefreshCw, Zap } from "lucide-vue-next";
import { useVueDevtoolsBridge } from "./vue-devtools/useVueDevtoolsBridge";
import { useCDP } from "@/composables/useCDP";

const iframeRef = ref<HTMLIFrameElement | null>(null);

const {
  attachIframe,
  start,
  frameHtml,
  errorMessage,
  statusLabel,
  capability,
  isReady,
  isAttached,
  isBlocked,
} = useVueDevtoolsBridge();
const { targetsStore } = useCDP();

async function boot(options?: { force?: boolean }) {
  if (iframeRef.value) {
    await attachIframe(iframeRef.value);
  }

  try {
    await start(options);
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
    <!-- Blocked targets never render the panel: its splash animation reads as
         progress when nothing can ever connect. -->
    <iframe
      v-if="!isBlocked"
      ref="iframeRef"
      :srcdoc="frameHtml"
      class="h-full w-full border-0"
      title="Vue DevTools"
    />

    <div
      v-if="isBlocked"
      class="absolute inset-0 flex items-center justify-center overflow-auto p-6"
    >
      <div class="max-w-2xl rounded-2xl border border-border/40 bg-surface-2 px-6 py-5">
        <div class="flex items-center gap-2 text-sm font-medium text-amber-400">
          <AlertTriangle :size="15" />
          {{ capability?.title ?? statusLabel }}
        </div>

        <p class="mt-3 text-sm leading-6 text-muted-foreground/85">
          {{ capability?.detail }}
        </p>

        <p v-if="capability?.hint" class="mt-3 text-sm leading-6 text-foreground/85">
          {{ capability.hint }}
        </p>

        <div
          v-if="capability?.probe"
          class="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-border/30 bg-surface-0 px-4 py-3 text-xs text-muted-foreground/70"
        >
          <span>Vue version</span>
          <span class="text-right text-foreground/80">{{
            capability.probe.vueVersion ?? "unknown"
          }}</span>
          <span>DevTools hook</span>
          <span class="text-right text-foreground/80">{{
            capability.probe.hasDevtoolsHook ? "present" : "absent"
          }}</span>
          <span>Registered apps</span>
          <span class="text-right text-foreground/80">{{ capability.probe.hookAppRecords }}</span>
          <span>app._instance</span>
          <span class="text-right text-foreground/80">{{
            capability.probe.hasAppInstance ? "kept" : "stripped"
          }}</span>
          <span>DOM back-references</span>
          <span class="text-right text-foreground/80">{{
            capability.probe.hasElementBackrefs ? "kept" : "stripped"
          }}</span>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <button
            class="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-surface-3 px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:bg-surface-3/70"
            @click="boot()"
          >
            <RefreshCw :size="12" />
            Re-check target
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-surface-0 px-3 py-1.5 text-xs text-muted-foreground/80 transition-colors hover:text-foreground"
            @click="boot({ force: true })"
          >
            <Zap :size="12" />
            Attach anyway
          </button>
        </div>
      </div>
    </div>

    <div
      v-else-if="!isAttached"
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

    <div
      v-else-if="!isReady"
      class="absolute inset-x-0 bottom-0 border-t border-border/40 bg-surface-2/95 px-4 py-3 text-xs text-muted-foreground/85"
    >
      <span class="font-medium text-amber-400">{{ statusLabel }}.</span>
      The injected runtime answers, but the app never emitted
      <code>app:init</code>, so the panel stays empty.
    </div>
  </div>
</template>
