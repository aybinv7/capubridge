<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { AlertTriangle, RefreshCw, Zap } from "lucide-vue-next";
import { describeReactBuild } from "./react-devtools/capability";
import { useReactDevtoolsBridge } from "./react-devtools/useReactDevtoolsBridge";
import { useCDP } from "@/composables/useCDP";

const iframeRef = ref<HTMLIFrameElement | null>(null);

const {
  attachIframe,
  start,
  panelHtml,
  status,
  errorMessage,
  capability,
  messagesFromTarget,
  bytesFromTarget,
  statusLabel,
  isReady,
  isBlocked,
} = useReactDevtoolsBridge();
const { targetsStore } = useCDP();

async function boot(options?: { force?: boolean }) {
  attachIframe(iframeRef.value);
  await start(options);
}

watch(iframeRef, (iframe) => attachIframe(iframe), { immediate: true });
watch(
  () => targetsStore.selectedTarget?.id ?? null,
  () => void boot(),
);
onMounted(() => void boot());

const showOverlay = computed(() => !isReady.value);

const facts = computed(() => {
  const probe = capability.value?.probe;
  if (!probe) return [];
  return [
    { label: "React version", value: probe.reactVersion ?? "unknown" },
    { label: "Build", value: describeReactBuild(probe) },
    { label: "Registered renderers", value: String(probe.rendererCount) },
    { label: "Backend attached", value: probe.backendAlreadyAttached ? "yes" : "no" },
    { label: "Messages from target", value: String(messagesFromTarget.value) },
    { label: "Received", value: `${(bytesFromTarget.value / 1024).toFixed(1)} KB` },
  ];
});
</script>

<template>
  <div class="relative h-full w-full overflow-hidden bg-surface-0">
    <iframe
      ref="iframeRef"
      :srcdoc="panelHtml"
      class="h-full w-full border-0"
      title="React DevTools"
    />

    <div
      v-if="showOverlay"
      class="absolute inset-0 flex items-center justify-center overflow-auto bg-surface-0/90 p-6 backdrop-blur-sm"
    >
      <div class="max-w-2xl rounded-2xl border border-border/40 bg-surface-2 px-6 py-5">
        <div
          class="flex items-center gap-2 text-sm font-medium"
          :class="status === 'error' || isBlocked ? 'text-amber-400' : 'text-foreground'"
        >
          <AlertTriangle v-if="status === 'error' || isBlocked" :size="15" />
          {{ capability?.title ?? statusLabel }}
        </div>

        <p class="mt-2 text-sm text-muted-foreground/80">{{ statusLabel }}</p>
        <p v-if="capability?.detail" class="mt-3 text-sm leading-6 text-muted-foreground/85">
          {{ capability.detail }}
        </p>
        <p v-if="capability?.hint" class="mt-3 text-sm leading-6 text-foreground/85">
          {{ capability.hint }}
        </p>
        <p v-if="errorMessage" class="mt-3 text-sm text-red-400">{{ errorMessage }}</p>

        <div
          v-if="facts.length"
          class="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-border/30 bg-surface-0 px-4 py-3 text-xs text-muted-foreground/70"
        >
          <template v-for="fact in facts" :key="fact.label">
            <span>{{ fact.label }}</span>
            <span class="text-right text-foreground/80">{{ fact.value }}</span>
          </template>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <button
            class="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-surface-3 px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:bg-surface-3/70"
            @click="boot()"
          >
            <RefreshCw :size="12" />
            Retry
          </button>
          <button
            v-if="isBlocked"
            class="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-surface-0 px-3 py-1.5 text-xs text-muted-foreground/80 transition-colors hover:text-foreground"
            @click="boot({ force: true })"
          >
            <Zap :size="12" />
            Attach anyway
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
