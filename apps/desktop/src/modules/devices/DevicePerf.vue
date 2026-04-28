<script setup lang="ts">
import { onMounted, computed } from "vue";
import {
  Cpu,
  MemoryStick,
  Battery,
  Wifi,
  ArrowDown,
  ArrowUp,
  Thermometer,
  Layers,
  AlertCircle,
} from "lucide-vue-next";
import { VisXYContainer, VisArea, VisLine, VisAxis } from "@unovis/vue";
import { CurveType } from "@unovis/ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { usePerfMetrics } from "./usePerfMetrics";

const {
  start,
  isRunning,
  error,
  tickCount,
  latest,
  coreCount,
  perCoreLatest,
  cpuSeries,
  memSeries,
  rxSeries,
  txSeries,
  heapUsedSeries,
  heapTotalSeries,
  domNodesSeries,
  cdpMetricsStatus,
  cdpMetricsMessage,
  cdpMetricsSource,
  cdpLastUpdatedAt,
  perCoreSeries,
} = usePerfMetrics();

onMounted(() => void start());

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

// ── Chart configs ───────────────────────────────────────────────────────────

const cpuChartConfig: ChartConfig = {
  cpu: { label: "CPU %", color: "#22d3ee" },
};
const memChartConfig: ChartConfig = {
  mem: { label: "Memory %", color: "#38bdf8" },
};
const netChartConfig: ChartConfig = {
  rx: { label: "Download", color: "#34d399" },
  tx: { label: "Upload", color: "#f59e0b" },
};
const heapUsedChartConfig: ChartConfig = {
  heapUsed: { label: "Heap Used", color: "#22d3ee" },
};
const heapTotalChartConfig: ChartConfig = {
  heapTotal: { label: "Heap Total", color: "#38bdf8" },
};
const domChartConfig: ChartConfig = {
  domNodes: { label: "DOM Nodes", color: "#a78bfa" },
};

const latestSampleX = computed(() => cpuSeries.value.at(-1)?.x ?? 0);
const latestSampleTimestamp = computed(() => latest.value?.timestamp ?? Date.now());
const perfTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function toSampleTimestamp(point: number | Date): number | null {
  if (point instanceof Date) {
    return point.getTime();
  }
  if (!Number.isFinite(point)) {
    return null;
  }
  const secondsAgo = Math.max(0, Math.round(latestSampleX.value - point));
  return latestSampleTimestamp.value - secondsAgo * 1000;
}

function formatPerfTime(point: number | Date): string {
  const ts = toSampleTimestamp(point);
  if (ts === null) {
    return "";
  }
  return perfTimeFormatter.format(ts);
}

const tooltipLabelFormatter = (point: number | Date) => {
  const label = formatPerfTime(point);
  return label ? `Time: ${label}` : "Time: --:--:--";
};
const axisTickFormatter = (point: number | Date) => formatPerfTime(point);
const yAxisTickFormatter = (point: number | Date) => {
  if (typeof point !== "number" || !Number.isFinite(point)) {
    return "";
  }
  const abs = Math.abs(point);
  if (abs >= 1000) {
    return Math.round(point).toLocaleString();
  }
  if (abs >= 100) {
    return point.toFixed(0);
  }
  if (abs >= 10) {
    return point.toFixed(1).replace(/\.0$/, "");
  }
  return point.toFixed(2).replace(/\.?0+$/, "");
};

function makeTooltipContent(config: ChartConfig) {
  return componentToString(config, ChartTooltipContent, {
    indicator: "line",
    labelFormatter: tooltipLabelFormatter,
  });
}

const cpuTooltipContent = makeTooltipContent(cpuChartConfig);
const memTooltipContent = makeTooltipContent(memChartConfig);
const netTooltipContent = makeTooltipContent(netChartConfig);
const heapUsedTooltipContent = makeTooltipContent(heapUsedChartConfig);
const heapTotalTooltipContent = makeTooltipContent(heapTotalChartConfig);
const domTooltipContent = makeTooltipContent(domChartConfig);

function toNiceAxisCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 1) {
    return 1;
  }
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function makeSeriesYDomain(series: Array<Record<string, number>>, key: string): [number, number] {
  const rawMax = series.reduce((max, point) => Math.max(max, Number(point[key] ?? 0)), 0);
  const paddedMax = rawMax > 0 ? rawMax * 1.12 : 1;
  return [0, toNiceAxisCeil(paddedMax)];
}

const rxYDomain = computed(() => makeSeriesYDomain(rxSeries.value, "rx"));
const txYDomain = computed(() => makeSeriesYDomain(txSeries.value, "tx"));
const heapUsedYDomain = computed(() => makeSeriesYDomain(heapUsedSeries.value, "heapUsed"));
const heapTotalYDomain = computed(() => makeSeriesYDomain(heapTotalSeries.value, "heapTotal"));
const domNodesYDomain = computed(() => makeSeriesYDomain(domNodesSeries.value, "domNodes"));

interface SeriesStats {
  now: number;
  min: number;
  max: number;
  avg: number;
}

function createSeriesStats(series: Array<Record<string, number>>, key: string): SeriesStats {
  const values = series
    .map((point) => Number(point[key] ?? 0))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return { now: 0, min: 0, max: 0, avg: 0 };
  }
  const now = values.at(-1) ?? 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { now, min, max, avg };
}

const heapUsedStats = computed(() => createSeriesStats(heapUsedSeries.value, "heapUsed"));
const heapTotalStats = computed(() => createSeriesStats(heapTotalSeries.value, "heapTotal"));
const domNodesStats = computed(() => createSeriesStats(domNodesSeries.value, "domNodes"));

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtBytes(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(0)} MB`;
  return `${kb} KB`;
}

function fmtBps(kbps: number): string {
  if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} MB/s`;
  return `${kbps.toFixed(0)} KB/s`;
}

function fmtMb(value: number): string {
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} MB`;
}

function fmtCount(value: number): string {
  return Math.round(value).toLocaleString();
}

function fmtSource(value: string | null | undefined): string {
  if (!value) {
    return "unavailable";
  }
  return value.replace(/[-_]/g, " ");
}

function levelColor(pct: number): string {
  if (pct >= 80) return "text-red-500";
  if (pct >= 60) return "text-amber-500";
  return "text-emerald-500";
}

function battColor(lvl: number): string {
  if (lvl < 20) return "text-red-500";
  if (lvl < 40) return "text-amber-500";
  return "text-emerald-500";
}

// ── Computed display values ───────────────────────────────────────────────────

const cpuPct = computed(() => Math.round(latest.value?.cpuTotal ?? 0));
const memPct = computed(() => Math.round(latest.value?.memory.usedPct ?? 0));
const rx = computed(() => (latest.value ? latest.value.network.rxBps / 1024 : 0));
const tx = computed(() => (latest.value ? latest.value.network.txBps / 1024 : 0));
const battery = computed(() => latest.value?.battery ?? null);
const cpuTemp = computed(() => latest.value?.cpuTemp ?? null);
const cpuTempSource = computed(() => fmtSource(latest.value?.cpuTempSource));

const cdpStatusClass = computed(() => {
  if (cdpMetricsStatus.value === "active") return "text-emerald-500";
  if (cdpMetricsStatus.value === "degraded") return "text-amber-500";
  if (cdpMetricsStatus.value === "error") return "text-red-500";
  return "text-muted-foreground";
});

const cdpStatusLabel = computed(() => {
  if (cdpMetricsStatus.value === "active") return "Live";
  if (cdpMetricsStatus.value === "degraded") return "Fallback";
  if (cdpMetricsStatus.value === "error") return "Error";
  if (cdpMetricsStatus.value === "waiting") return "Waiting";
  return "Idle";
});

const cdpSourceLabel = computed(() => fmtSource(cdpMetricsSource.value));
const cdpLastUpdatedLabel = computed(() => {
  if (!cdpLastUpdatedAt.value) {
    return "—";
  }
  return perfTimeFormatter.format(cdpLastUpdatedAt.value);
});

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

// ── SVG defs for gradients ───────────────────────────────────────────────────
const svgDefs = `
  <linearGradient id="fillCpu" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="#22d3ee" stop-opacity="0.72"/>
    <stop offset="95%" stop-color="#22d3ee" stop-opacity="0.08"/>
  </linearGradient>
  <linearGradient id="fillMem" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="#38bdf8" stop-opacity="0.72"/>
    <stop offset="95%" stop-color="#38bdf8" stop-opacity="0.08"/>
  </linearGradient>
  <linearGradient id="fillRx" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="#34d399" stop-opacity="0.72"/>
    <stop offset="95%" stop-color="#34d399" stop-opacity="0.08"/>
  </linearGradient>
  <linearGradient id="fillTx" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="#f59e0b" stop-opacity="0.72"/>
    <stop offset="95%" stop-color="#f59e0b" stop-opacity="0.08"/>
  </linearGradient>
`;
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden select-none">
    <!-- Error banner -->
    <div
      v-if="error"
      class="shrink-0 mx-4 mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-400"
    >
      <AlertCircle class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <div class="font-medium">Failed to start performance monitoring</div>
        <div class="mt-0.5 font-mono text-[10px] text-red-400/70">
          {{ error }}
        </div>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="!isRunning && tickCount === 0 && !error" class="flex-1 overflow-y-auto p-3">
      <div class="mb-3 grid grid-cols-3 gap-3">
        <Card v-for="i in 3" :key="i">
          <CardHeader class="pb-2">
            <div class="flex items-center gap-2">
              <Skeleton class="h-4 w-4 rounded" />
              <Skeleton class="h-4 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton class="h-[124px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Main content -->
    <div
      v-else-if="isRunning || tickCount > 0"
      class="flex-1 overflow-y-auto p-3 [&_[data-slot=card]]:gap-3 [&_[data-slot=card]]:py-4 [&_[data-slot=card-content]]:px-4 [&_[data-slot=card-header]]:px-4"
    >
      <!-- ── CPU + Memory Row ──────────────────────────────────────────────── -->
      <div class="mb-3 grid grid-cols-2 gap-3">
        <!-- CPU Total -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle class="text-sm font-medium flex items-center gap-2">
              <Cpu class="h-4 w-4" />
              CPU Total
            </CardTitle>
            <span class="font-mono text-2xl font-bold" :class="levelColor(cpuPct)">
              {{ cpuPct }}%
            </span>
          </CardHeader>
          <CardContent>
            <ChartContainer :config="cpuChartConfig" class="aspect-auto h-32 w-full">
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
                  color="url(#fillCpu)"
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
                <ChartTooltip :template="cpuTooltipContent" />
                <ChartCrosshair :template="cpuTooltipContent" />
              </VisXYContainer>
            </ChartContainer>
            <p class="text-xs text-muted-foreground mt-2">{{ coreCount }} cores · avg across all</p>
          </CardContent>
        </Card>

        <!-- Memory -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle class="text-sm font-medium flex items-center gap-2">
              <MemoryStick class="h-4 w-4 text-sky-500" />
              Memory
            </CardTitle>
            <div class="text-right">
              <span class="font-mono text-2xl font-bold" :class="levelColor(memPct)">
                {{ memPct }}%
              </span>
              <p v-if="latest?.memory" class="text-[10px] text-muted-foreground">
                {{ fmtBytes(latest.memory.usedKb) }} /
                {{ fmtBytes(latest.memory.totalKb) }}
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
                  color="url(#fillMem)"
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
                <ChartTooltip :template="memTooltipContent" />
                <ChartCrosshair :template="memTooltipContent" />
              </VisXYContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <!-- ── Per-core mini grid ────────────────────────────────────────────── -->
      <Card class="mb-3">
        <CardHeader class="pb-1">
          <CardTitle class="text-sm font-medium flex items-center gap-2">
            <Cpu class="h-4 w-4" />
            Per Core — live
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            v-if="coreCount > 0"
            class="grid gap-2"
            :class="coreCount <= 4 ? 'grid-cols-4' : coreCount <= 6 ? 'grid-cols-6' : 'grid-cols-8'"
          >
            <div
              v-for="(core, i) in perCoreLatest"
              :key="i"
              class="flex flex-col gap-1 rounded-lg bg-muted/50 p-2"
            >
              <div class="flex items-center justify-between">
                <span class="text-[10px] text-muted-foreground">CPU{{ core.core }}</span>
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
          <div v-else class="flex h-20 items-center justify-center text-sm text-muted-foreground">
            Waiting for CPU data…
          </div>
        </CardContent>
      </Card>

      <div class="mb-3 grid grid-cols-3 gap-3">
        <!-- ── Network ──────────────────────────────────────────────────────── -->
        <Card class="col-span-2 h-full">
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle class="text-sm font-medium flex items-center gap-2">
              <Wifi class="h-4 w-4 text-violet-500" />
              Network
            </CardTitle>
            <div class="flex items-center gap-4 text-xs">
              <div class="flex items-center gap-1">
                <ArrowDown class="h-3 w-3 text-emerald-500" />
                <span class="font-mono font-semibold text-emerald-500">{{ fmtBps(rx) }}</span>
              </div>
              <div class="flex items-center gap-1">
                <ArrowUp class="h-3 w-3 text-amber-500" />
                <span class="font-mono font-semibold text-amber-500">{{ fmtBps(tx) }}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent class="flex-1 min-h-0">
            <div class="grid h-full min-h-0 grid-cols-2 gap-3">
              <div class="flex h-full min-h-0 flex-col">
                <p class="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <ArrowDown class="h-3 w-3 text-emerald-500" /> Download
                </p>
                <ChartContainer
                  :config="netChartConfig"
                  class="aspect-auto h-full min-h-[160px] w-full flex-1"
                >
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
                      color="url(#fillRx)"
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
                    <ChartTooltip :template="netTooltipContent" />
                    <ChartCrosshair :template="netTooltipContent" />
                  </VisXYContainer>
                </ChartContainer>
              </div>
              <div class="flex h-full min-h-0 flex-col">
                <p class="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <ArrowUp class="h-3 w-3 text-amber-500" /> Upload
                </p>
                <ChartContainer
                  :config="netChartConfig"
                  class="aspect-auto h-full min-h-[160px] w-full flex-1"
                >
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
                      color="url(#fillTx)"
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
                    <ChartTooltip :template="netTooltipContent" />
                    <ChartCrosshair :template="netTooltipContent" />
                  </VisXYContainer>
                </ChartContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- ── Battery + Temperature ──────────────────────────────────────── -->
        <div class="col-span-1 flex flex-col gap-3">
          <!-- Battery -->
          <Card>
            <CardHeader class="pb-1">
              <CardTitle class="text-sm font-medium flex items-center gap-2">
                <Battery class="h-4 w-4 text-emerald-500" />
                Battery
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                class="font-mono text-3xl font-bold"
                :class="battery ? battColor(battery.level) : 'text-muted-foreground'"
              >
                {{ battery?.level ?? "--" }}%
              </div>
              <p class="text-xs text-muted-foreground mt-1">
                {{ battery?.charging ? "Charging" : "Discharging" }}
              </p>
              <div class="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-700"
                  :class="
                    battery && battery.level < 20
                      ? 'bg-red-500'
                      : battery && battery.level < 40
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  "
                  :style="{ width: `${battery?.level ?? 0}%` }"
                />
              </div>
            </CardContent>
          </Card>

          <!-- Temperature -->
          <Card>
            <CardHeader class="pb-1">
              <CardTitle class="text-sm font-medium flex items-center gap-2">
                <Thermometer class="h-4 w-4 text-orange-500" />
                Temperature
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                class="font-mono text-3xl font-bold"
                :class="
                  cpuTemp && cpuTemp > 50
                    ? 'text-red-500'
                    : cpuTemp && cpuTemp > 40
                      ? 'text-amber-500'
                      : 'text-orange-500'
                "
              >
                {{ cpuTemp != null ? cpuTemp.toFixed(1) : "--" }}°C
              </div>
              <p class="text-xs text-muted-foreground mt-1">Source: {{ cpuTempSource }}</p>
              <p v-if="cpuTemp == null" class="text-[10px] text-muted-foreground mt-0.5">
                CPU thermal sensor not exposed on this device build.
              </p>
              <p v-if="battery?.temperature" class="text-[10px] text-muted-foreground mt-0.5">
                Battery: {{ battery.temperature.toFixed(1) }}°C
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- ── WebView / CDP metrics ─────────────────────────────────────────── -->
      <Card>
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-1">
          <CardTitle class="text-sm font-medium flex items-center gap-2">
            <Layers class="h-4 w-4 text-sky-500" />
            WebView · CDP Metrics
          </CardTitle>
          <div class="text-right">
            <p class="text-xs font-semibold" :class="cdpStatusClass">
              {{ cdpStatusLabel }}
            </p>
            <p class="text-[10px] text-muted-foreground">Source: {{ cdpSourceLabel }}</p>
            <p class="text-[10px] text-muted-foreground">Last update: {{ cdpLastUpdatedLabel }}</p>
          </div>
        </CardHeader>
        <CardContent>
          <p class="mb-2 text-[10px] text-muted-foreground">
            {{ cdpMetricsMessage }}
          </p>
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
                  <ChartTooltip :template="heapUsedTooltipContent" />
                  <ChartCrosshair :template="heapUsedTooltipContent" />
                </VisXYContainer>
              </ChartContainer>
              <p class="mt-2 text-[10px] text-muted-foreground">
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
                  <ChartTooltip :template="heapTotalTooltipContent" />
                  <ChartCrosshair :template="heapTotalTooltipContent" />
                </VisXYContainer>
              </ChartContainer>
              <p class="mt-2 text-[10px] text-muted-foreground">
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
                  <ChartTooltip :template="domTooltipContent" />
                  <ChartCrosshair :template="domTooltipContent" />
                </VisXYContainer>
              </ChartContainer>
              <p class="mt-2 text-[10px] text-muted-foreground">
                Now {{ fmtCount(domNodesStats.now) }} · Avg {{ fmtCount(domNodesStats.avg) }} · Peak
                {{ fmtCount(domNodesStats.max) }}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
