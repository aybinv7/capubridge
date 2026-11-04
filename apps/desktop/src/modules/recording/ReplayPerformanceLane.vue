<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";
import {
  Activity,
  Cpu,
  MemoryStick,
  Battery,
  Wifi,
  ArrowDown,
  ArrowUp,
  Thermometer,
  Layers,
} from "lucide-vue-next";
import { VisXYContainer, VisArea, VisLine, VisAxis } from "@unovis/vue";
import { CurveType } from "@unovis/ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from "@/components/ui/chart";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PerfCapuEvent, NetworkCapuEvent } from "@/types/replay.types";
import ReplayPerfUnavailableCard from "./ReplayPerfUnavailableCard.vue";
import {
  batteryBarColor,
  batteryStateLabel,
  batteryTextColor,
  buildPerCoreSeries,
  buildSeries,
  coreCountOf,
  createStats,
  detectPerfAvailability,
  fmtBps,
  fmtBytes,
  fmtCount,
  fmtMb,
  fmtPct,
  levelColor,
  makeSeriesYDomain,
  upperBound,
} from "./replayPerfSeries";

const props = defineProps<{
  perfEvents: PerfCapuEvent[];
  networkEvents: NetworkCapuEvent[];
  positionMs: number;
  duration: number;
}>();

// ── Data layer ───────────────────────────────────────────────────────────────
// Pre-sort once per events change (not per positionMs tick)
const sortedEvents = computed(() => [...props.perfEvents].sort((a, b) => a.t - b.t));

// `latest` — reactive to positionMs for the stat displays (big numbers)
// Uses O(log n) binary search, cheap enough to run every frame.
const latest = computed(() => {
  const arr = sortedEvents.value;
  const idx = upperBound(arr, props.positionMs) - 1;
  return idx >= 0 ? (arr[idx]?.data ?? null) : null;
});

// `filtered` — for chart rendering only.
// Backed by a shallowRef so Vue only propagates a change when the *count* changes
// (roughly once per second as new samples arrive) rather than on every rAF tick.
const filtered = shallowRef<PerfCapuEvent[]>([]);
watch(
  [sortedEvents, () => props.positionMs] as const,
  ([sorted, pos]) => {
    const count = upperBound(sorted, pos);
    if (count !== filtered.value.length) {
      filtered.value = sorted.slice(0, count);
    }
  },
  { immediate: true },
);

const hasPerfData = computed(() => sortedEvents.value.length > 0);
const availability = computed(() => detectPerfAvailability(sortedEvents.value));

// ── Accessors ────────────────────────────────────────────────────────────────
const xAcc = (d: { x: number }) => d.x;
const yValue = (key: string) => (d: Record<string, number>) => Number(d[key] ?? 0);
const cpuY = [yValue("cpu")];
const memY = [yValue("mem")];
const rxY = [yValue("rx")];
const txY = [yValue("tx")];
const heapUsedY = [yValue("heapUsed")];
const heapTotalY = [yValue("heapTotal")];
const domNodesY = [yValue("domNodes")];
const perCoreY = [yValue("y")];

// ── Series ───────────────────────────────────────────────────────────────────
// These only recompute when `filtered` changes (i.e. when a new sample is included)
const cpuSeries = computed(() => buildSeries(filtered.value, "cpuTotal", "cpu"));
const memSeries = computed(() => buildSeries(filtered.value, "memUsedPct", "mem"));
const rxSeries = computed(() => buildSeries(filtered.value, "rxBps", "rx", 1 / 1024));
const txSeries = computed(() => buildSeries(filtered.value, "txBps", "tx", 1 / 1024));
const heapUsedSeries = computed(() => buildSeries(filtered.value, "jsHeapUsedMb", "heapUsed"));
const heapTotalSeries = computed(() => buildSeries(filtered.value, "jsHeapTotalMb", "heapTotal"));
const domNodesSeries = computed(() => buildSeries(filtered.value, "domNodes", "domNodes"));

const coreCount = computed(() => coreCountOf(filtered.value));
const perCoreLatest = computed(() => latest.value?.cpuCores ?? []);
const perCoreSeries = computed(() => buildPerCoreSeries(filtered.value));

const latestRxKbps = computed(() =>
  latest.value?.rxBps == null ? null : latest.value.rxBps / 1024,
);
const latestTxKbps = computed(() =>
  latest.value?.txBps == null ? null : latest.value.txBps / 1024,
);

// ── Chart configs ─────────────────────────────────────────────────────────────
const cpuChartConfig: ChartConfig = { cpu: { label: "CPU %", color: "#22d3ee" } };
const memChartConfig: ChartConfig = { mem: { label: "Memory %", color: "#38bdf8" } };
const netChartConfig: ChartConfig = {
  rx: { label: "Download", color: "#34d399" },
  tx: { label: "Upload", color: "#f59e0b" },
};
const heapUsedChartConfig: ChartConfig = {
  heapUsed: { label: "Heap Used (MB)", color: "#22d3ee" },
};
const heapTotalChartConfig: ChartConfig = {
  heapTotal: { label: "Heap Total (MB)", color: "#38bdf8" },
};
const domChartConfig: ChartConfig = { domNodes: { label: "DOM Nodes", color: "#a78bfa" } };

const coreColors = [
  "#22d3ee",
  "#38bdf8",
  "#60a5fa",
  "#818cf8",
  "#a78bfa",
  "#f472b6",
  "#f59e0b",
  "#34d399",
];

// ── SVG gradients ─────────────────────────────────────────────────────────────
const svgDefs = `
  <linearGradient id="rp-fillCpu" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="#22d3ee" stop-opacity="0.72"/>
    <stop offset="95%" stop-color="#22d3ee" stop-opacity="0.08"/>
  </linearGradient>
  <linearGradient id="rp-fillMem" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="#38bdf8" stop-opacity="0.72"/>
    <stop offset="95%" stop-color="#38bdf8" stop-opacity="0.08"/>
  </linearGradient>
  <linearGradient id="rp-fillRx" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="#34d399" stop-opacity="0.72"/>
    <stop offset="95%" stop-color="#34d399" stop-opacity="0.08"/>
  </linearGradient>
  <linearGradient id="rp-fillTx" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="#f59e0b" stop-opacity="0.72"/>
    <stop offset="95%" stop-color="#f59e0b" stop-opacity="0.08"/>
  </linearGradient>
`;

// ── Axis / tooltip formatters ──────────────────────────────────────────────────
const rxYDomain = computed(() => makeSeriesYDomain(rxSeries.value, "rx"));
const txYDomain = computed(() => makeSeriesYDomain(txSeries.value, "tx"));
const heapUsedYDomain = computed(() => makeSeriesYDomain(heapUsedSeries.value, "heapUsed"));
const heapTotalYDomain = computed(() => makeSeriesYDomain(heapTotalSeries.value, "heapTotal"));
const domNodesYDomain = computed(() => makeSeriesYDomain(domNodesSeries.value, "domNodes"));

const heapUsedStats = computed(() => createStats(heapUsedSeries.value, "heapUsed"));
const heapTotalStats = computed(() => createStats(heapTotalSeries.value, "heapTotal"));
const domNodesStats = computed(() => createStats(domNodesSeries.value, "domNodes"));
const hasJsMetrics = computed(() => availability.value.js);

const yAxisTickFormatter = (point: number | Date): string => {
  if (typeof point !== "number" || !Number.isFinite(point)) return "";
  const abs = Math.abs(point);
  if (abs >= 1000) return Math.round(point).toLocaleString();
  if (abs >= 100) return point.toFixed(0);
  if (abs >= 10) return point.toFixed(1).replace(/\.0$/, "");
  return point.toFixed(2).replace(/\.?0+$/, "");
};

const axisTickFormatter = (point: number | Date): string => {
  if (typeof point !== "number") return "";
  const idx = Math.round(point);
  const ev = filtered.value[idx];
  if (!ev) return "";
  const s = Math.floor(ev.t / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `+${m}m${s % 60}s` : `+${s}s`;
};

const tooltipLabelFormatter = (point: number | Date): string => {
  const s = axisTickFormatter(point);
  return s ? `Time: ${s}` : "Time: --";
};

function makeTooltip(config: ChartConfig) {
  return componentToString(config, ChartTooltipContent, {
    indicator: "line",
    labelFormatter: tooltipLabelFormatter,
  });
}

const cpuTooltip = makeTooltip(cpuChartConfig);
const memTooltip = makeTooltip(memChartConfig);
const netTooltip = makeTooltip(netChartConfig);
const heapUsedTooltip = makeTooltip(heapUsedChartConfig);
const heapTotalTooltip = makeTooltip(heapTotalChartConfig);
const domTooltip = makeTooltip(domChartConfig);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <div
      v-if="!hasPerfData"
      class="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground/40"
    >
      <Activity class="h-8 w-8 opacity-30" />
      <p class="text-xs">Performance track not recorded</p>
      <p class="text-2xs opacity-60">Enable the Performance track in the recording config</p>
    </div>

    <ScrollArea v-else class="flex-1 min-h-0">
      <div
        class="p-3 [&_[data-slot=card]]:gap-3 [&_[data-slot=card]]:py-4 [&_[data-slot=card-content]]:px-4 [&_[data-slot=card-header]]:px-4"
      >
        <!-- CPU + Memory -->
        <div class="mb-3 grid grid-cols-2 gap-3">
          <ReplayPerfUnavailableCard
            v-if="!availability.cpu"
            title="CPU Total"
            :icon="Cpu"
            metric="CPU usage"
          />
          <Card v-else>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle class="text-sm font-medium flex items-center gap-2">
                <Cpu class="h-4 w-4" /> CPU Total
              </CardTitle>
              <span
                class="font-mono text-2xl font-bold"
                :class="levelColor(latest?.cpuTotal ?? null)"
              >
                {{ fmtPct(latest?.cpuTotal ?? null) }}
              </span>
            </CardHeader>
            <CardContent>
              <ChartContainer :config="cpuChartConfig" class="aspect-auto h-[128px] w-full">
                <VisXYContainer
                  :data="cpuSeries"
                  :svg-defs="svgDefs"
                  :y-domain="[0, 100]"
                  :margin="{ left: 40, right: 10 }"
                >
                  <VisArea
                    :x="xAcc"
                    :y="cpuY"
                    :curve-type="CurveType.MonotoneX"
                    color="url(#rp-fillCpu)"
                    :opacity="1"
                  />
                  <VisLine
                    :x="xAcc"
                    :y="cpuY"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-cpu)"
                    :line-width="2"
                  />
                  <VisAxis
                    type="y"
                    :num-ticks="3"
                    :tick-format="yAxisTickFormatter"
                    :tick-line="false"
                    :domain-line="false"
                  />
                  <VisAxis
                    type="x"
                    :num-ticks="4"
                    :tick-format="axisTickFormatter"
                    :tick-line="false"
                    :domain-line="false"
                    :grid-line="false"
                  />
                  <ChartTooltip :template="cpuTooltip" />
                </VisXYContainer>
              </ChartContainer>
              <p class="text-xs text-muted-foreground mt-2">
                {{ coreCount }} cores · {{ filtered.length }} samples
              </p>
            </CardContent>
          </Card>

          <ReplayPerfUnavailableCard
            v-if="!availability.memory"
            title="Memory"
            :icon="MemoryStick"
            metric="system memory"
          />
          <Card v-else>
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle class="text-sm font-medium flex items-center gap-2">
                <MemoryStick class="h-4 w-4 text-info" /> Memory
              </CardTitle>
              <div class="text-right">
                <span
                  class="font-mono text-2xl font-bold"
                  :class="levelColor(latest?.memUsedPct ?? null)"
                >
                  {{ fmtPct(latest?.memUsedPct ?? null) }}
                </span>
                <p
                  v-if="latest?.memUsedKb != null && latest.memTotalKb != null"
                  class="text-2xs text-muted-foreground"
                >
                  {{ fmtBytes(latest.memUsedKb) }} / {{ fmtBytes(latest.memTotalKb) }}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer :config="memChartConfig" class="aspect-auto h-[128px] w-full">
                <VisXYContainer
                  :data="memSeries"
                  :svg-defs="svgDefs"
                  :y-domain="[0, 100]"
                  :margin="{ left: 40, right: 10 }"
                >
                  <VisArea
                    :x="xAcc"
                    :y="memY"
                    :curve-type="CurveType.MonotoneX"
                    color="url(#rp-fillMem)"
                    :opacity="1"
                  />
                  <VisLine
                    :x="xAcc"
                    :y="memY"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-mem)"
                    :line-width="2"
                  />
                  <VisAxis
                    type="y"
                    :num-ticks="3"
                    :tick-format="yAxisTickFormatter"
                    :tick-line="false"
                    :domain-line="false"
                  />
                  <VisAxis
                    type="x"
                    :num-ticks="4"
                    :tick-format="axisTickFormatter"
                    :tick-line="false"
                    :domain-line="false"
                    :grid-line="false"
                  />
                  <ChartTooltip :template="memTooltip" />
                </VisXYContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        <!-- Per-core grid -->
        <Card v-if="coreCount > 0" class="mb-3">
          <CardHeader class="pb-1">
            <CardTitle class="text-sm font-medium flex items-center gap-2">
              <Cpu class="h-4 w-4" /> Per Core
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              class="grid gap-2"
              :class="
                coreCount <= 4 ? 'grid-cols-4' : coreCount <= 6 ? 'grid-cols-6' : 'grid-cols-8'
              "
            >
              <div
                v-for="(core, i) in perCoreLatest"
                :key="i"
                class="flex flex-col gap-1 rounded-lg bg-muted/50 p-2"
              >
                <div class="flex items-center justify-between">
                  <span class="text-2xs text-muted-foreground">CPU{{ core.core }}</span>
                  <span
                    class="font-mono text-xs font-semibold"
                    :style="{ color: coreColors[i % coreColors.length] }"
                  >
                    {{ Math.round(core.usage) }}%
                  </span>
                </div>
                <div class="h-8 w-full">
                  <VisXYContainer
                    :data="perCoreSeries[i] ?? []"
                    :y-domain="[0, 100]"
                    :margin="{ top: 0, bottom: 0, left: 0, right: 0 }"
                    class="h-full w-full"
                  >
                    <VisArea
                      :x="xAcc"
                      :y="perCoreY"
                      :curve-type="CurveType.MonotoneX"
                      :color="coreColors[i % coreColors.length]"
                      :opacity="0.2"
                    />
                    <VisLine
                      :x="xAcc"
                      :y="perCoreY"
                      :curve-type="CurveType.MonotoneX"
                      :color="coreColors[i % coreColors.length]"
                      :line-width="1.5"
                    />
                  </VisXYContainer>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- Network -->
        <div class="mb-3 grid grid-cols-3 gap-3">
          <ReplayPerfUnavailableCard
            v-if="!availability.network"
            class="col-span-2"
            title="Network"
            :icon="Wifi"
            metric="network throughput"
          />
          <Card v-else class="col-span-2">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle class="text-sm font-medium flex items-center gap-2">
                <Wifi class="h-4 w-4 text-violet-500" /> Network
              </CardTitle>
              <div class="flex items-center gap-4 text-xs">
                <div class="flex items-center gap-1">
                  <ArrowDown class="h-3 w-3 text-success" />
                  <span class="font-mono font-semibold text-success">
                    {{ fmtBps(latestRxKbps) }}
                  </span>
                </div>
                <div class="flex items-center gap-1">
                  <ArrowUp class="h-3 w-3 text-warning" />
                  <span class="font-mono font-semibold text-warning">
                    {{ fmtBps(latestTxKbps) }}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <p class="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <ArrowDown class="h-3 w-3 text-success" /> Download
                  </p>
                  <ChartContainer :config="netChartConfig" class="aspect-auto h-[128px] w-full">
                    <VisXYContainer
                      :data="rxSeries"
                      :svg-defs="svgDefs"
                      :y-domain="rxYDomain"
                      :margin="{ left: 40, right: 10 }"
                    >
                      <VisArea
                        :x="xAcc"
                        :y="rxY"
                        :curve-type="CurveType.MonotoneX"
                        color="url(#rp-fillRx)"
                        :opacity="1"
                      />
                      <VisLine
                        :x="xAcc"
                        :y="rxY"
                        :curve-type="CurveType.MonotoneX"
                        color="var(--color-rx)"
                        :line-width="1.5"
                      />
                      <VisAxis
                        type="y"
                        :num-ticks="3"
                        :tick-format="yAxisTickFormatter"
                        :tick-line="false"
                        :domain-line="false"
                      />
                      <VisAxis
                        type="x"
                        :num-ticks="3"
                        :tick-format="axisTickFormatter"
                        :tick-line="false"
                        :domain-line="false"
                        :grid-line="false"
                      />
                      <ChartTooltip :template="netTooltip" />
                    </VisXYContainer>
                  </ChartContainer>
                </div>
                <div>
                  <p class="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <ArrowUp class="h-3 w-3 text-warning" /> Upload
                  </p>
                  <ChartContainer :config="netChartConfig" class="aspect-auto h-[128px] w-full">
                    <VisXYContainer
                      :data="txSeries"
                      :svg-defs="svgDefs"
                      :y-domain="txYDomain"
                      :margin="{ left: 40, right: 10 }"
                    >
                      <VisArea
                        :x="xAcc"
                        :y="txY"
                        :curve-type="CurveType.MonotoneX"
                        color="url(#rp-fillTx)"
                        :opacity="1"
                      />
                      <VisLine
                        :x="xAcc"
                        :y="txY"
                        :curve-type="CurveType.MonotoneX"
                        color="var(--color-tx)"
                        :line-width="1.5"
                      />
                      <VisAxis
                        type="y"
                        :num-ticks="3"
                        :tick-format="yAxisTickFormatter"
                        :tick-line="false"
                        :domain-line="false"
                      />
                      <VisAxis
                        type="x"
                        :num-ticks="3"
                        :tick-format="axisTickFormatter"
                        :tick-line="false"
                        :domain-line="false"
                        :grid-line="false"
                      />
                      <ChartTooltip :template="netTooltip" />
                    </VisXYContainer>
                  </ChartContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- Battery + Temperature -->
          <div class="col-span-1 flex flex-col gap-3">
            <ReplayPerfUnavailableCard
              v-if="!availability.battery"
              title="Battery"
              :icon="Battery"
              metric="battery state"
            />
            <Card v-else>
              <CardHeader class="pb-1">
                <CardTitle class="text-sm font-medium flex items-center gap-2">
                  <Battery class="h-4 w-4 text-success" /> Battery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  class="font-mono text-3xl font-bold"
                  :class="batteryTextColor(latest?.batteryLevel ?? null)"
                >
                  {{ fmtPct(latest?.batteryLevel ?? null) }}
                </div>
                <p class="text-xs text-muted-foreground mt-1">
                  {{ batteryStateLabel(latest?.batteryCharging ?? null) }}
                </p>
                <div class="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="batteryBarColor(latest?.batteryLevel ?? null)"
                    :style="{ width: `${latest?.batteryLevel ?? 0}%` }"
                  />
                </div>
              </CardContent>
            </Card>

            <ReplayPerfUnavailableCard
              v-if="!availability.temperature"
              title="Temperature"
              :icon="Thermometer"
              metric="thermal sensors"
            />
            <Card v-else>
              <CardHeader class="pb-1">
                <CardTitle class="text-sm font-medium flex items-center gap-2">
                  <Thermometer class="h-4 w-4 text-warning" /> Temperature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  class="font-mono text-3xl font-bold"
                  :class="
                    latest?.cpuTemp && latest.cpuTemp > 50
                      ? 'text-error'
                      : latest?.cpuTemp && latest.cpuTemp > 40
                        ? 'text-warning'
                        : 'text-warning'
                  "
                >
                  {{ latest?.cpuTemp != null ? latest.cpuTemp.toFixed(1) : "--" }}°C
                </div>
                <p v-if="latest?.batteryTemp != null" class="text-2xs text-muted-foreground mt-1">
                  Battery: {{ latest.batteryTemp.toFixed(1) }}°C
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <!-- WebView / CDP Metrics -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle class="text-sm font-medium flex items-center gap-2">
              <Layers class="h-4 w-4 text-info" /> WebView · CDP Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div v-if="!hasJsMetrics" class="text-xs text-muted-foreground/50 mb-3">
              No WebView metrics (CDP Performance domain unavailable during recording)
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <p class="text-xs text-muted-foreground mb-2">JS Heap Used</p>
                <ChartContainer :config="heapUsedChartConfig" class="aspect-auto h-[104px] w-full">
                  <VisXYContainer
                    :data="heapUsedSeries"
                    :y-domain="heapUsedYDomain"
                    :margin="{ left: 40, right: 10 }"
                  >
                    <VisArea
                      :x="xAcc"
                      :y="heapUsedY"
                      :curve-type="CurveType.MonotoneX"
                      color="var(--color-heapUsed)"
                      :opacity="0.3"
                    />
                    <VisLine
                      :x="xAcc"
                      :y="heapUsedY"
                      :curve-type="CurveType.MonotoneX"
                      color="var(--color-heapUsed)"
                      :line-width="1.5"
                    />
                    <VisAxis
                      type="y"
                      :num-ticks="3"
                      :tick-format="yAxisTickFormatter"
                      :tick-line="false"
                      :domain-line="false"
                    />
                    <VisAxis
                      type="x"
                      :num-ticks="3"
                      :tick-format="axisTickFormatter"
                      :tick-line="false"
                      :domain-line="false"
                      :grid-line="false"
                    />
                    <ChartTooltip :template="heapUsedTooltip" />
                  </VisXYContainer>
                </ChartContainer>
                <p class="mt-2 text-2xs text-muted-foreground">
                  Now {{ fmtMb(heapUsedStats.now) }} · Avg {{ fmtMb(heapUsedStats.avg) }} · Peak
                  {{ fmtMb(heapUsedStats.max) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground mb-2">JS Heap Total</p>
                <ChartContainer :config="heapTotalChartConfig" class="aspect-auto h-[104px] w-full">
                  <VisXYContainer
                    :data="heapTotalSeries"
                    :y-domain="heapTotalYDomain"
                    :margin="{ left: 40, right: 10 }"
                  >
                    <VisArea
                      :x="xAcc"
                      :y="heapTotalY"
                      :curve-type="CurveType.MonotoneX"
                      color="var(--color-heapTotal)"
                      :opacity="0.3"
                    />
                    <VisLine
                      :x="xAcc"
                      :y="heapTotalY"
                      :curve-type="CurveType.MonotoneX"
                      color="var(--color-heapTotal)"
                      :line-width="1.5"
                    />
                    <VisAxis
                      type="y"
                      :num-ticks="3"
                      :tick-format="yAxisTickFormatter"
                      :tick-line="false"
                      :domain-line="false"
                    />
                    <VisAxis
                      type="x"
                      :num-ticks="3"
                      :tick-format="axisTickFormatter"
                      :tick-line="false"
                      :domain-line="false"
                      :grid-line="false"
                    />
                    <ChartTooltip :template="heapTotalTooltip" />
                  </VisXYContainer>
                </ChartContainer>
                <p class="mt-2 text-2xs text-muted-foreground">
                  Now {{ fmtMb(heapTotalStats.now) }} · Avg {{ fmtMb(heapTotalStats.avg) }} · Peak
                  {{ fmtMb(heapTotalStats.max) }}
                </p>
              </div>
              <div>
                <p class="text-xs text-muted-foreground mb-2">DOM Nodes</p>
                <ChartContainer :config="domChartConfig" class="aspect-auto h-[104px] w-full">
                  <VisXYContainer
                    :data="domNodesSeries"
                    :y-domain="domNodesYDomain"
                    :margin="{ left: 40, right: 10 }"
                  >
                    <VisArea
                      :x="xAcc"
                      :y="domNodesY"
                      :curve-type="CurveType.MonotoneX"
                      color="var(--color-domNodes)"
                      :opacity="0.3"
                    />
                    <VisLine
                      :x="xAcc"
                      :y="domNodesY"
                      :curve-type="CurveType.MonotoneX"
                      color="var(--color-domNodes)"
                      :line-width="1.5"
                    />
                    <VisAxis
                      type="y"
                      :num-ticks="3"
                      :tick-format="yAxisTickFormatter"
                      :tick-line="false"
                      :domain-line="false"
                    />
                    <VisAxis
                      type="x"
                      :num-ticks="3"
                      :tick-format="axisTickFormatter"
                      :tick-line="false"
                      :domain-line="false"
                      :grid-line="false"
                    />
                    <ChartTooltip :template="domTooltip" />
                  </VisXYContainer>
                </ChartContainer>
                <p class="mt-2 text-2xs text-muted-foreground">
                  Now {{ fmtCount(domNodesStats.now) }} · Avg {{ fmtCount(domNodesStats.avg) }} ·
                  Peak {{ fmtCount(domNodesStats.max) }}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  </div>
</template>
