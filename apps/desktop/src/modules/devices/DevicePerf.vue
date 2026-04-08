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
  BarChart2,
  AlertCircle,
} from "lucide-vue-next";
import { VisXYContainer, VisArea, VisLine, VisAxis, VisTooltip } from "@unovis/vue";
import { CurveType } from "@unovis/ts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
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
  gpuSeries,
  heapUsedSeries,
  heapTotalSeries,
  domNodesSeries,
  perCoreSeries,
} = usePerfMetrics();

onMounted(() => void start());

// ── Accessors ────────────────────────────────────────────────────────────────

const xAcc = (d: { x: number; y: number }) => d.x;
const yAcc = (d: { x: number; y: number }) => d.y;
const yAccArr = [yAcc];

// ── Chart configs ───────────────────────────────────────────────────────────

const cpuChartConfig: ChartConfig = {
  cpu: { label: "CPU %", color: "var(--chart-1)" },
};
const memChartConfig: ChartConfig = {
  mem: { label: "Memory %", color: "var(--chart-2)" },
};
const gpuChartConfig: ChartConfig = {
  gpu: { label: "GPU %", color: "var(--chart-3)" },
};
const netChartConfig: ChartConfig = {
  rx: { label: "Download", color: "var(--chart-4)" },
  tx: { label: "Upload", color: "var(--chart-5)" },
};
const heapUsedChartConfig: ChartConfig = {
  heapUsed: { label: "Heap Used", color: "var(--chart-1)" },
};
const heapTotalChartConfig: ChartConfig = {
  heapTotal: { label: "Heap Total", color: "var(--chart-2)" },
};
const domChartConfig: ChartConfig = {
  domNodes: { label: "DOM Nodes", color: "var(--chart-3)" },
};

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
const gpuPct = computed(() => Math.round(latest.value?.gpuUsage ?? 0));

const coreColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#a78bfa",
  "#f472b6",
  "#34d399",
];

// ── SVG defs for gradients ───────────────────────────────────────────────────
const svgDefs = `
  <linearGradient id="fillCpu" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="var(--color-cpu)" stop-opacity="0.8"/>
    <stop offset="95%" stop-color="var(--color-cpu)" stop-opacity="0.1"/>
  </linearGradient>
  <linearGradient id="fillMem" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="var(--color-mem)" stop-opacity="0.8"/>
    <stop offset="95%" stop-color="var(--color-mem)" stop-opacity="0.1"/>
  </linearGradient>
  <linearGradient id="fillGpu" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="var(--color-gpu)" stop-opacity="0.8"/>
    <stop offset="95%" stop-color="var(--color-gpu)" stop-opacity="0.1"/>
  </linearGradient>
  <linearGradient id="fillRx" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="var(--color-rx)" stop-opacity="0.8"/>
    <stop offset="95%" stop-color="var(--color-rx)" stop-opacity="0.1"/>
  </linearGradient>
  <linearGradient id="fillTx" x1="0" y1="0" x2="0" y2="1">
    <stop offset="5%" stop-color="var(--color-tx)" stop-opacity="0.8"/>
    <stop offset="95%" stop-color="var(--color-tx)" stop-opacity="0.1"/>
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
    <div v-if="!isRunning && tickCount === 0 && !error" class="flex-1 overflow-y-auto p-4">
      <div class="grid grid-cols-3 gap-4 mb-4">
        <Card v-for="i in 3" :key="i">
          <CardHeader class="pb-2">
            <div class="flex items-center gap-2">
              <Skeleton class="h-4 w-4 rounded" />
              <Skeleton class="h-4 w-20" />
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton class="h-[100px] w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- Main content -->
    <div v-else-if="isRunning || tickCount > 0" class="flex-1 overflow-y-auto p-4">
      <!-- ── CPU + Memory Row ──────────────────────────────────────────────── -->
      <div class="grid grid-cols-2 gap-4 mb-4">
        <!-- CPU Total -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium flex items-center gap-2">
              <Cpu class="h-4 w-4" />
              CPU Total
            </CardTitle>
            <span class="font-mono text-2xl font-bold" :class="levelColor(cpuPct)">
              {{ cpuPct }}%
            </span>
          </CardHeader>
          <CardContent>
            <ChartContainer :config="cpuChartConfig" class="aspect-auto h-[100px] w-full">
              <VisXYContainer
                :data="cpuSeries"
                :svg-defs="svgDefs"
                :y-domain="[0, 100]"
                :margin="{ left: -20, right: 10 }"
              >
                <VisArea
                  :x="xAcc"
                  :y="yAccArr"
                  :curve-type="CurveType.MonotoneX"
                  color="url(#fillCpu)"
                  :opacity="1"
                />
                <VisLine
                  :x="xAcc"
                  :y="yAccArr"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-cpu)"
                  :line-width="2"
                />
                <VisAxis type="y" :num-ticks="3" :tick-line="false" :domain-line="false" />
                <VisAxis
                  type="x"
                  :num-ticks="0"
                  :tick-line="false"
                  :domain-line="false"
                  :grid-line="false"
                />
                <ChartTooltip />
              </VisXYContainer>
            </ChartContainer>
            <p class="text-xs text-muted-foreground mt-2">{{ coreCount }} cores · avg across all</p>
          </CardContent>
        </Card>

        <!-- Memory -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium flex items-center gap-2">
              <MemoryStick class="h-4 w-4 text-sky-500" />
              Memory
            </CardTitle>
            <div class="text-right">
              <span class="font-mono text-2xl font-bold" :class="levelColor(memPct)">
                {{ memPct }}%
              </span>
              <p v-if="latest?.memory" class="text-[10px] text-muted-foreground">
                {{ fmtBytes(latest.memory.usedKb) }} / {{ fmtBytes(latest.memory.totalKb) }}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer :config="memChartConfig" class="aspect-auto h-[100px] w-full">
              <VisXYContainer
                :data="memSeries"
                :svg-defs="svgDefs"
                :y-domain="[0, 100]"
                :margin="{ left: -20, right: 10 }"
              >
                <VisArea
                  :x="xAcc"
                  :y="yAccArr"
                  :curve-type="CurveType.MonotoneX"
                  color="url(#fillMem)"
                  :opacity="1"
                />
                <VisLine
                  :x="xAcc"
                  :y="yAccArr"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-mem)"
                  :line-width="2"
                />
                <VisAxis type="y" :num-ticks="3" :tick-line="false" :domain-line="false" />
                <VisAxis
                  type="x"
                  :num-ticks="0"
                  :tick-line="false"
                  :domain-line="false"
                  :grid-line="false"
                />
                <ChartTooltip />
              </VisXYContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <!-- ── Per-core mini grid ────────────────────────────────────────────── -->
      <Card class="mb-4">
        <CardHeader class="pb-2">
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
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    :color="coreColors[i % coreColors.length]"
                    :opacity="0.2"
                  />
                  <VisLine
                    :x="xAcc"
                    :y="yAccArr"
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

      <!-- ── Network ──────────────────────────────────────────────────────── -->
      <Card class="mb-4">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
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
        <CardContent>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <p class="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <ArrowDown class="h-3 w-3 text-emerald-500" /> Download
              </p>
              <ChartContainer :config="netChartConfig" class="aspect-auto h-[80px] w-full">
                <VisXYContainer
                  :data="rxSeries"
                  :svg-defs="svgDefs"
                  :y-domain-min-constraint="[0, undefined]"
                  :margin="{ left: -20, right: 10 }"
                >
                  <VisArea
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="url(#fillRx)"
                    :opacity="1"
                  />
                  <VisLine
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-rx)"
                    :line-width="1.5"
                  />
                  <VisAxis type="y" :num-ticks="2" :tick-line="false" :domain-line="false" />
                  <VisAxis
                    type="x"
                    :num-ticks="0"
                    :tick-line="false"
                    :domain-line="false"
                    :grid-line="false"
                  />
                  <ChartTooltip />
                </VisXYContainer>
              </ChartContainer>
            </div>
            <div>
              <p class="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <ArrowUp class="h-3 w-3 text-amber-500" /> Upload
              </p>
              <ChartContainer :config="netChartConfig" class="aspect-auto h-[80px] w-full">
                <VisXYContainer
                  :data="txSeries"
                  :svg-defs="svgDefs"
                  :y-domain-min-constraint="[0, undefined]"
                  :margin="{ left: -20, right: 10 }"
                >
                  <VisArea
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="url(#fillTx)"
                    :opacity="1"
                  />
                  <VisLine
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-tx)"
                    :line-width="1.5"
                  />
                  <VisAxis type="y" :num-ticks="2" :tick-line="false" :domain-line="false" />
                  <VisAxis
                    type="x"
                    :num-ticks="0"
                    :tick-line="false"
                    :domain-line="false"
                    :grid-line="false"
                  />
                  <ChartTooltip />
                </VisXYContainer>
              </ChartContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- ── Battery + Temp + GPU ─────────────────────────────────────────── -->
      <div class="grid grid-cols-3 gap-4 mb-4">
        <!-- Battery -->
        <Card>
          <CardHeader class="pb-2">
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
          <CardHeader class="pb-2">
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
            <p class="text-xs text-muted-foreground mt-1">CPU zone 0</p>
            <p v-if="battery?.temperature" class="text-[10px] text-muted-foreground mt-0.5">
              Battery: {{ battery.temperature.toFixed(1) }}°C
            </p>
          </CardContent>
        </Card>

        <!-- GPU -->
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium flex items-center gap-2">
              <BarChart2 class="h-4 w-4 text-purple-500" />
              GPU
            </CardTitle>
            <span class="font-mono text-2xl font-bold" :class="levelColor(gpuPct)">
              {{ latest?.gpuUsage != null ? `${gpuPct}%` : "—" }}
            </span>
          </CardHeader>
          <CardContent>
            <ChartContainer :config="gpuChartConfig" class="aspect-auto h-[80px] w-full">
              <VisXYContainer
                :data="gpuSeries"
                :svg-defs="svgDefs"
                :y-domain="[0, 100]"
                :margin="{ left: -20, right: 10 }"
              >
                <VisArea
                  :x="xAcc"
                  :y="yAccArr"
                  :curve-type="CurveType.MonotoneX"
                  color="url(#fillGpu)"
                  :opacity="1"
                />
                <VisLine
                  :x="xAcc"
                  :y="yAccArr"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-gpu)"
                  :line-width="1.5"
                />
                <VisAxis type="y" :num-ticks="3" :tick-line="false" :domain-line="false" />
                <VisAxis
                  type="x"
                  :num-ticks="0"
                  :tick-line="false"
                  :domain-line="false"
                  :grid-line="false"
                />
                <ChartTooltip />
              </VisXYContainer>
            </ChartContainer>
            <p class="text-xs text-muted-foreground mt-2">Snapdragon GPU busy %</p>
          </CardContent>
        </Card>
      </div>

      <!-- ── WebView / CDP metrics ─────────────────────────────────────────── -->
      <Card>
        <CardHeader class="pb-2">
          <CardTitle class="text-sm font-medium flex items-center gap-2">
            <Layers class="h-4 w-4 text-sky-500" />
            WebView · CDP Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div class="grid grid-cols-3 gap-4">
            <div>
              <p class="text-xs text-muted-foreground mb-2">JS Heap Used</p>
              <ChartContainer :config="heapUsedChartConfig" class="aspect-auto h-[80px] w-full">
                <VisXYContainer
                  :data="heapUsedSeries"
                  :y-domain-min-constraint="[0, undefined]"
                  :margin="{ left: -20, right: 10 }"
                >
                  <VisArea
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-heapUsed)"
                    :opacity="0.3"
                  />
                  <VisLine
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-heapUsed)"
                    :line-width="1.5"
                  />
                  <VisAxis type="y" :num-ticks="2" :tick-line="false" :domain-line="false" />
                  <VisAxis
                    type="x"
                    :num-ticks="0"
                    :tick-line="false"
                    :domain-line="false"
                    :grid-line="false"
                  />
                  <ChartTooltip />
                </VisXYContainer>
              </ChartContainer>
            </div>
            <div>
              <p class="text-xs text-muted-foreground mb-2">JS Heap Total</p>
              <ChartContainer :config="heapTotalChartConfig" class="aspect-auto h-[80px] w-full">
                <VisXYContainer
                  :data="heapTotalSeries"
                  :y-domain-min-constraint="[0, undefined]"
                  :margin="{ left: -20, right: 10 }"
                >
                  <VisArea
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-heapTotal)"
                    :opacity="0.3"
                  />
                  <VisLine
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-heapTotal)"
                    :line-width="1.5"
                  />
                  <VisAxis type="y" :num-ticks="2" :tick-line="false" :domain-line="false" />
                  <VisAxis
                    type="x"
                    :num-ticks="0"
                    :tick-line="false"
                    :domain-line="false"
                    :grid-line="false"
                  />
                  <ChartTooltip />
                </VisXYContainer>
              </ChartContainer>
            </div>
            <div>
              <p class="text-xs text-muted-foreground mb-2">DOM Nodes</p>
              <ChartContainer :config="domChartConfig" class="aspect-auto h-[80px] w-full">
                <VisXYContainer
                  :data="domNodesSeries"
                  :y-domain-min-constraint="[0, undefined]"
                  :margin="{ left: -20, right: 10 }"
                >
                  <VisArea
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-domNodes)"
                    :opacity="0.3"
                  />
                  <VisLine
                    :x="xAcc"
                    :y="yAccArr"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-domNodes)"
                    :line-width="1.5"
                  />
                  <VisAxis type="y" :num-ticks="2" :tick-line="false" :domain-line="false" />
                  <VisAxis
                    type="x"
                    :num-ticks="0"
                    :tick-line="false"
                    :domain-line="false"
                    :grid-line="false"
                  />
                  <ChartTooltip />
                </VisXYContainer>
              </ChartContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
