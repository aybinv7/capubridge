<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useDocumentVisibility } from "@vueuse/core";
import { ArrowUpRight, Play } from "lucide-vue-next";
import { Button, Spinner, StatusDot } from "@capubridge/cladd";
import PerfWebView from "@/shared/perf/webview/PerfWebView.vue";
import { useWebViewMetrics } from "@/shared/perf/webview/useWebViewMetrics";
import { useAppSession } from "../appSession";
import { openLabel } from "../lifecycle/lifecycle";
import AppTotals from "./AppTotals.vue";
import ProcessCharts from "./ProcessCharts.vue";
import ReadingBar from "./ReadingBar.vue";

const HISTORY_MS = 5 * 60_000;

const route = useRoute();
const visibility = useDocumentVisibility();
const { app, process, phase: processState, lifecycle } = useAppSession();
const { phase, copy, mark, runState } = processState;
const { paused, lastSampleAt, error } = process;
const presence = app.presence;

const webView = useWebViewMetrics(
  computed(() => visibility.value === "visible" && !paused.value),
  { historyMs: HISTORY_MS },
);

const hasReadings = computed(() => lastSampleAt.value !== null);
const waiting = computed(() => phase.value === "starting" && !hasReadings.value);
const offerOpen = computed(() => runState.value === "stopped" || runState.value === "background");
const timeWindow = computed<[number, number]>(() => {
  const end = Math.max(lastSampleAt.value ?? 0, webView.updatedAt.value ?? 0) || Date.now();
  return [end - HISTORY_MS, end];
});
const scroller = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (route.hash !== "#totals") return;
  await nextTick();
  scroller.value?.querySelector("#totals")?.scrollIntoView({ block: "start" });
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ReadingBar
      :last-sample-at="lastSampleAt"
      :paused="paused"
      @pause="process.pause()"
      @resume="process.resume()"
    />

    <div ref="scroller" class="@container min-h-0 flex-1 overflow-y-auto">
      <div class="flex flex-col gap-6 p-4">
        <section class="flex flex-col gap-3" aria-labelledby="app-process-title">
          <header class="flex min-w-0 items-center gap-2" role="status" aria-live="polite">
            <h2 id="app-process-title" class="shrink-0 text-sm font-medium text-foreground">
              The app's process
            </h2>
            <StatusDot :color="mark.color" :variant="mark.variant" />
            <span class="shrink-0 text-xs text-muted-foreground">{{ copy.label }}</span>
            <span class="min-w-0 truncate text-xs text-[var(--fg-subtle)]">{{ copy.detail }}</span>
            <span class="flex-1" />
            <Button
              v-if="offerOpen"
              size="sm"
              variant="transparent"
              :disabled="lifecycle.busy.value"
              content-class-name="gap-1.5 px-2.5 [&>svg]:size-3.5"
              class="shrink-0"
              @click="lifecycle.open()"
            >
              <ArrowUpRight v-if="runState === 'background'" :stroke-width="1.8" />
              <Play v-else :stroke-width="1.8" />
              {{ openLabel(runState === "background") }}
            </Button>
          </header>

          <div
            v-if="phase === 'error'"
            class="flex items-start gap-3 rounded-control bg-surface-cut px-3 py-2 shadow-cut"
            role="alert"
          >
            <div class="flex min-w-0 flex-1 flex-col gap-0.5">
              <p class="text-xs text-foreground">{{ copy.detail }}</p>
              <p class="font-mono text-2xs break-all text-error">{{ error }}</p>
            </div>
            <Button size="sm" variant="transparent" @click="process.retry()">Try again</Button>
          </div>

          <div v-if="waiting" class="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Spinner size="xs" />
            {{ copy.detail }}
          </div>
          <ProcessCharts v-if="hasReadings" :process="process" :window="timeWindow" />
        </section>

        <PerfWebView
          :status="webView.status.value"
          :source="webView.source.value"
          :presence="presence"
          :updated-at="webView.updatedAt.value"
          :failure="webView.failure.value"
          :series="webView.series"
          :x-domain="timeWindow"
        />

        <AppTotals />
      </div>
    </div>
  </div>
</template>
