<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { useDocumentVisibility } from "@vueuse/core";
import { Button, Spinner } from "@capubridge/cladd";
import PerfStatusBar from "@/shared/perf/PerfStatusBar.vue";
import PerfWebView from "@/shared/perf/webview/PerfWebView.vue";
import { useWebViewMetrics } from "@/shared/perf/webview/useWebViewMetrics";
import { useAppSession } from "../appSession";
import AppTotals from "./AppTotals.vue";
import ProcessCharts from "./ProcessCharts.vue";

const route = useRoute();
const visibility = useDocumentVisibility();
const { app, process, phase: processState, lifecycle } = useAppSession();
const { phase, copy, mark } = processState;
const { paused, lastSampleAt, error } = process;
const presence = app.presence;

const webView = useWebViewMetrics(computed(() => visibility.value === "visible" && !paused.value));

const hasReadings = computed(() => lastSampleAt.value !== null);
const waiting = computed(() => phase.value === "starting");
const stopped = computed(() => phase.value === "not-running");
const hasHistory = computed(() => process.values("pss").some((value) => value !== null));
const scroller = ref<HTMLElement | null>(null);

onMounted(async () => {
  if (route.hash !== "#totals") return;
  await nextTick();
  scroller.value?.querySelector("#totals")?.scrollIntoView({ block: "start" });
});
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <PerfStatusBar
      :dot="mark"
      :copy="copy"
      :last-sample-at="lastSampleAt"
      :paused="paused"
      :show-detail="hasReadings"
      @pause="process.pause()"
      @resume="process.resume()"
    />

    <div ref="scroller" class="@container min-h-0 flex-1 overflow-y-auto">
      <div class="flex flex-col gap-6 p-4">
        <section class="flex flex-col gap-3" aria-labelledby="app-process-title">
          <h2 id="app-process-title" class="text-sm font-medium text-foreground">
            The app's process
          </h2>

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

          <div
            v-if="!hasReadings && phase !== 'error'"
            class="flex items-center gap-2 py-6 text-xs text-muted-foreground"
          >
            <Spinner v-if="waiting" size="xs" />
            {{ copy.detail }}
          </div>
          <div
            v-if="stopped"
            class="flex items-center gap-3 rounded-control bg-surface-cut px-3 py-2.5 shadow-cut"
          >
            <p class="min-w-0 flex-1 text-xs text-muted-foreground">{{ copy.detail }}</p>
            <Button
              size="sm"
              variant="solid-fill"
              :disabled="lifecycle.busy.value"
              @click="lifecycle.open()"
            >
              Open
            </Button>
          </div>
          <ProcessCharts v-if="hasHistory" :process="process" />
        </section>

        <PerfWebView
          :status="webView.status.value"
          :source="webView.source.value"
          :presence="presence"
          :updated-at="webView.updatedAt.value"
          :failure="webView.failure.value"
          :series="webView.series"
        />

        <AppTotals />
      </div>
    </div>
  </div>
</template>
