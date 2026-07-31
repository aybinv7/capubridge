<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-vue-next";
import {
  REACT_CAPABILITY_PROBE_EXPRESSION,
  describeReactBuild,
  interpretReactCapability,
  parseReactCapabilityProbe,
} from "./react-devtools/capability";
import type { ReactCapabilityReport } from "./react-devtools/capability";
import { useInspectPlugins } from "./useInspectPlugins";
import { useCDP } from "@/composables/useCDP";

const { evaluateOnTarget } = useInspectPlugins();
const { targetsStore } = useCDP();

const report = ref<ReactCapabilityReport | null>(null);
const isProbing = ref(false);
const probeError = ref<string | null>(null);

const isReady = computed(() => report.value?.kind === "ready");

async function probe() {
  isProbing.value = true;
  probeError.value = null;

  try {
    const raw = await evaluateOnTarget(REACT_CAPABILITY_PROBE_EXPRESSION);
    report.value = interpretReactCapability(parseReactCapabilityProbe(raw));
  } catch (error) {
    probeError.value = error instanceof Error ? error.message : String(error);
    report.value = null;
  } finally {
    isProbing.value = false;
  }
}

watch(() => targetsStore.selectedTarget?.id ?? null, probe, { immediate: true });

const facts = computed(() => {
  const probeResult = report.value?.probe;
  if (!probeResult) return [];
  return [
    { label: "React version", value: probeResult.reactVersion ?? "unknown" },
    { label: "Build", value: describeReactBuild(probeResult) },
    { label: "Fiber roots", value: probeResult.hasFibers ? "present" : "absent" },
    { label: "DevTools hook", value: probeResult.hasHook ? "present" : "absent" },
    { label: "Registered renderers", value: String(probeResult.rendererCount) },
    {
      label: "Backend attached",
      value: probeResult.backendAlreadyAttached ? "yes" : "no",
    },
  ];
});
</script>

<template>
  <div class="h-full w-full overflow-auto bg-surface-0 p-6">
    <div class="mx-auto max-w-2xl rounded-2xl border border-border/40 bg-surface-2 px-6 py-5">
      <div v-if="probeError" class="flex items-center gap-2 text-sm font-medium text-red-400">
        <AlertTriangle :size="15" />
        Probe failed: {{ probeError }}
      </div>

      <template v-else-if="report">
        <div
          class="flex items-center gap-2 text-sm font-medium"
          :class="isReady ? 'text-emerald-400' : 'text-amber-400'"
        >
          <CheckCircle2 v-if="isReady" :size="15" />
          <AlertTriangle v-else :size="15" />
          {{ report.title }}
        </div>

        <p class="mt-3 text-sm leading-6 text-muted-foreground/85">{{ report.detail }}</p>
        <p v-if="report.hint" class="mt-3 text-sm leading-6 text-foreground/85">
          {{ report.hint }}
        </p>

        <div
          v-if="facts.length"
          class="mt-4 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-border/30 bg-surface-0 px-4 py-3 text-xs text-muted-foreground/70"
        >
          <template v-for="fact in facts" :key="fact.label">
            <span>{{ fact.label }}</span>
            <span class="text-right text-foreground/80">{{ fact.value }}</span>
          </template>
        </div>
      </template>

      <div v-else class="text-sm text-muted-foreground/70">Probing the React runtime…</div>

      <div class="mt-4 flex items-center gap-2">
        <button
          class="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-surface-3 px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:bg-surface-3/70 disabled:opacity-50"
          :disabled="isProbing"
          @click="probe"
        >
          <RefreshCw :size="12" :class="isProbing ? 'animate-spin' : ''" />
          Re-check target
        </button>
      </div>

      <p class="mt-4 text-xs leading-5 text-muted-foreground/60">
        Detection only for now — the DevTools backend connects over a WebSocket via
        <code>adb reverse</code>, which is the next piece.
      </p>
    </div>
  </div>
</template>
