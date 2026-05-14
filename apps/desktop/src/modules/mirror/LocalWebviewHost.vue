<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { Loader2, Monitor } from "lucide-vue-next";
import { useLocalWebviewStore } from "@/stores/localWebview.store";
import type { CDPTarget } from "@/types/cdp.types";

const props = defineProps<{
  target: CDPTarget | null;
}>();

const localWebviewStore = useLocalWebviewStore();
const hostRef = ref<HTMLElement | null>(null);
const error = ref<string | null>(null);
let resizeObserver: ResizeObserver | null = null;

const status = computed(() =>
  props.target ? (localWebviewStore.entries[props.target.id]?.status ?? "creating") : "creating",
);

async function attach() {
  const target = props.target;
  const host = hostRef.value;
  if (!target || target.source !== "local" || !host) {
    await localWebviewStore.hideAll();
    return;
  }

  error.value = null;
  try {
    await localWebviewStore.attachToElement(target, host);
  } catch (err) {
    error.value = String(err);
  }
}

async function resize() {
  const target = props.target;
  const host = hostRef.value;
  if (!target || target.source !== "local" || !host) return;
  await localWebviewStore.resizeToElement(target, host).catch(() => null);
}

onMounted(() => {
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      void resize();
    });
    if (hostRef.value) {
      resizeObserver.observe(hostRef.value);
    }
  }
  window.addEventListener("resize", resize);
  void nextTick(attach);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener("resize", resize);
  void localWebviewStore.hideAll();
});

watch(
  () => [props.target?.id, props.target?.url, localWebviewStore.layoutRevision] as const,
  async (_next, _prev, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    await nextTick();
    if (!cancelled) {
      await attach();
    }
  },
);
</script>

<template>
  <div ref="hostRef" class="relative h-full w-full overflow-hidden bg-zinc-950">
    <div
      v-if="error"
      class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
    >
      <Monitor class="h-8 w-8 text-muted-foreground/20" />
      <p class="text-xs text-error">{{ error }}</p>
    </div>
    <div
      v-else-if="status !== 'ready'"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3"
    >
      <Loader2 class="h-5 w-5 animate-spin text-muted-foreground/35" />
      <p class="text-xs text-muted-foreground/35">Opening local webview…</p>
    </div>
  </div>
</template>
