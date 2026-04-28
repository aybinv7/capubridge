<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  Activity,
  AlertCircle,
  Boxes,
  Cpu,
  Database,
  Layers3,
  MemoryStick,
  Network,
  Sparkles,
} from "lucide-vue-next";
import { CurveType } from "@unovis/ts";
import { VisArea, VisAxis, VisLine, VisXYContainer } from "@unovis/vue";
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from "@/components/ui/chart";
import type { AppCpuInfo, AppMemInfo } from "@/types/app-inspector.types";
import { useAppWebMetrics } from "./useAppWebMetrics";

const props = defineProps<{
  targetId: string;
  isReady: boolean;
  isLive: boolean;
  liveError: string | null;
  memInfo: AppMemInfo | null;
  cpuInfo: AppCpuInfo | null;
}>();

const HISTORY = 36;

function emptyHistory(defaultValue: number) {
  return Array.from({ length: HISTORY }, () => defaultValue);
}

function push<T>(values: T[], next: T) {
  return [...values.slice(1), next];
}

function pushWithCarry(values: number[], next: number | null) {
  return push(values, next ?? values.at(-1) ?? 0);
}

function toSeries(values: number[], key: string, tick: number) {
  return values.map((value, index) => ({
    x: tick - values.length + index + 1,
    [key]: value,
  }));
}

function createStats(values: number[]) {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) {
    return { now: 0, min: 0, max: 0, avg: 0 };
  }
  const now = finiteValues.at(-1) ?? 0;
  const min = Math.min(...finiteValues);
  const max = Math.max(...finiteValues);
  const avg = finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
  return { now, min, max, avg };
}

function toNiceAxisCeil(value: number) {
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

function makeSeriesDomain(series: Array<Record<string, number>>, key: string): [number, number] {
  const maxValue = series.reduce((max, point) => Math.max(max, Number(point[key] ?? 0)), 0);
  return [0, toNiceAxisCeil(maxValue > 0 ? maxValue * 1.15 : 1)];
}

function fmtMb(value: number) {
  if (value >= 1024) {
    return `${(value / 1024).toFixed(2)} GB`;
  }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} MB`;
}

function fmtCount(value: number) {
  return Math.round(value).toLocaleString();
}

const cpuHistory = ref<number[]>(emptyHistory(0));
const nativeMemoryHistory = ref<number[]>(emptyHistory(0));
const threadHistory = ref<number[]>(emptyHistory(0));
const nativeTick = ref(0);

watch(
  () => props.targetId,
  () => {
    cpuHistory.value = emptyHistory(0);
    nativeMemoryHistory.value = emptyHistory(0);
    threadHistory.value = emptyHistory(0);
    nativeTick.value = 0;
  },
);

watch(
  () => ({
    cpu: props.cpuInfo?.totalPct ?? null,
    pssMb: props.memInfo ? props.memInfo.totalPssKb / 1024 : null,
    threads: props.memInfo?.threadCount ?? null,
  }),
  (sample) => {
    if (!props.isReady) {
      return;
    }
    nativeTick.value += 1;
    cpuHistory.value = pushWithCarry(cpuHistory.value, sample.cpu);
    nativeMemoryHistory.value = pushWithCarry(nativeMemoryHistory.value, sample.pssMb);
    threadHistory.value = pushWithCarry(threadHistory.value, sample.threads);
  },
  { deep: true },
);

const cpuSeries = computed(() => toSeries(cpuHistory.value, "cpu", nativeTick.value));
const nativeMemorySeries = computed(() =>
  toSeries(nativeMemoryHistory.value, "memory", nativeTick.value),
);
const threadSeries = computed(() => toSeries(threadHistory.value, "threads", nativeTick.value));

const cpuStats = computed(() => createStats(cpuHistory.value));
const nativeMemoryStats = computed(() => createStats(nativeMemoryHistory.value));
const threadStats = computed(() => createStats(threadHistory.value));

const cpuConfig: ChartConfig = {
  cpu: { label: "CPU %", color: "#38bdf8" },
};
const nativeMemoryConfig: ChartConfig = {
  memory: { label: "Total PSS", color: "#f59e0b" },
};
const heapConfig: ChartConfig = {
  heapUsed: { label: "Heap Used", color: "#14b8a6" },
  heapTotal: { label: "Heap Total", color: "#6366f1" },
};
const domConfig: ChartConfig = {
  domNodes: { label: "DOM Nodes", color: "#f97316" },
};
const threadConfig: ChartConfig = {
  threads: { label: "Threads", color: "#a855f7" },
};

const xAccessor = (d: { x: number }) => d.x;
const yValue = (key: string) => (d: Record<string, number>) => Number(d[key] ?? 0);
const cpuY = [yValue("cpu")];
const nativeMemoryY = [yValue("memory")];
const heapUsedY = [yValue("heapUsed")];
const heapTotalY = [yValue("heapTotal")];
const domNodesY = [yValue("domNodes")];
const threadY = [yValue("threads")];

function makeTooltip(config: ChartConfig) {
  return componentToString(config, ChartTooltipContent, {
    indicator: "line",
    labelFormatter: (point: number | Date) => {
      const value = typeof point === "number" ? point : 0;
      return `Tick ${Math.max(0, value)}`;
    },
  });
}

const cpuTooltip = makeTooltip(cpuConfig);
const nativeMemoryTooltip = makeTooltip(nativeMemoryConfig);
const heapTooltip = makeTooltip(heapConfig);
const domTooltip = makeTooltip(domConfig);
const threadTooltip = makeTooltip(threadConfig);

const webMetrics = useAppWebMetrics(
  computed(() => props.targetId),
  computed(() => props.isReady),
);

const heapSeries = computed(() =>
  webMetrics.heapUsedSeries.value.map((point, index) => ({
    x: point.x,
    heapUsed: Number(point.heapUsed ?? 0),
    heapTotal: Number(webMetrics.heapTotalSeries.value[index]?.heapTotal ?? 0),
  })),
);

const heapStats = computed(() =>
  createStats(webMetrics.heapUsedSeries.value.map((point) => Number(point.heapUsed ?? 0))),
);
const domStats = computed(() =>
  createStats(webMetrics.domNodesSeries.value.map((point) => Number(point.domNodes ?? 0))),
);

const cpuDomain = computed<[number, number]>(() => [0, 100]);
const nativeMemoryDomain = computed(() => makeSeriesDomain(nativeMemorySeries.value, "memory"));
const heapDomain = computed(() => makeSeriesDomain(webMetrics.heapTotalSeries.value, "heapTotal"));
const domDomain = computed(() => makeSeriesDomain(webMetrics.domNodesSeries.value, "domNodes"));
const threadDomain = computed(() => makeSeriesDomain(threadSeries.value, "threads"));

const webStatusClass = computed(() => {
  if (webMetrics.status.value === "active") return "text-emerald-400";
  if (webMetrics.status.value === "degraded") return "text-amber-400";
  if (webMetrics.status.value === "error") return "text-red-400";
  return "text-muted-foreground/60";
});

const memoryBreakdown = computed(() => {
  const memInfo = props.memInfo;
  if (!memInfo || memInfo.totalPssKb <= 0) {
    return [];
  }
  const total = memInfo.totalPssKb;
  const segments = [
    {
      key: "native",
      label: "Native",
      value: memInfo.nativeHeapKb,
      color: "bg-amber-500",
    },
    {
      key: "dalvik",
      label: "Dalvik",
      value: memInfo.dalvikHeapKb,
      color: "bg-sky-500",
    },
    {
      key: "code",
      label: "Code",
      value: memInfo.codeKb,
      color: "bg-violet-500",
    },
    {
      key: "graphics",
      label: "Graphics",
      value: memInfo.graphicsKb,
      color: "bg-emerald-500",
    },
    {
      key: "stack",
      label: "Stack",
      value: memInfo.stackKb,
      color: "bg-fuchsia-500",
    },
    {
      key: "other",
      label: "Other",
      value: memInfo.otherKb,
      color: "bg-muted-foreground/35",
    },
  ];

  return segments
    .filter((segment) => segment.value > 0)
    .map((segment) => ({
      ...segment,
      pct: (segment.value / total) * 100,
      valueMb: segment.value / 1024,
    }));
});
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="liveError"
      class="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/6 px-3 py-2 text-xs text-red-300"
    >
      <AlertCircle class="mt-0.5 h-4 w-4 shrink-0" />
      <div class="min-w-0">
        <div class="font-medium">Native runtime stream failed</div>
        <div class="mt-1 font-mono text-[11px] text-red-300/70">
          {{ liveError }}
        </div>
      </div>
    </div>

    <section class="overflow-hidden rounded-lg border border-border/25 bg-surface-0">
      <div
        class="flex h-9 items-center gap-2 border-b border-border/20 bg-surface-1 px-3 text-xs font-medium"
      >
        <Layers3 class="h-3.5 w-3.5" />
        Memory composition
      </div>

      <div v-if="memoryBreakdown.length" class="p-3">
        <div class="flex h-4 overflow-hidden rounded-full bg-surface-3/80">
          <div
            v-for="segment in memoryBreakdown"
            :key="segment.key"
            :class="segment.color"
            :style="{ width: `${segment.pct}%` }"
          />
        </div>

        <div class="mt-3 grid gap-2 md:grid-cols-3 xl:grid-cols-6">
          <div
            v-for="segment in memoryBreakdown"
            :key="segment.key"
            class="rounded border border-border/20 bg-surface-1 px-3 py-2"
          >
            <div class="flex items-center gap-2">
              <span class="h-2.5 w-2.5 rounded-full" :class="segment.color" />
              <span class="text-xs text-muted-foreground/65">{{ segment.label }}</span>
            </div>
            <div class="mt-2 text-sm font-semibold text-foreground">
              {{ fmtMb(segment.valueMb) }}
            </div>
            <div class="mt-1 text-xs text-muted-foreground/45">
              {{ segment.pct.toFixed(0) }}% of total
            </div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="m-3 rounded-lg border border-dashed border-border/30 bg-surface-1 px-4 py-8 text-center text-xs text-muted-foreground/40"
      >
        Native memory breakdown appears once app process exposes meminfo.
      </div>
    </section>

    <div class="grid gap-4 xl:grid-cols-[minmax(340px,0.78fr)_minmax(0,1.22fr)]">
      <section class="overflow-hidden rounded-lg border border-border/25 bg-surface-0">
        <div
          class="flex items-center justify-between gap-4 border-b border-border/20 bg-surface-1 px-3 py-2"
        >
          <div class="min-w-0">
            <div class="flex items-center gap-2 text-xs font-medium">
              <Activity class="h-3.5 w-3.5" />
              Native runtime
            </div>
            <div class="mt-2 flex items-end gap-4">
              <div>
                <div class="text-xl font-semibold text-foreground">
                  {{ props.cpuInfo ? props.cpuInfo.totalPct.toFixed(1) : "0.0" }}%
                </div>
                <div class="text-[10px] text-muted-foreground/45">CPU now</div>
              </div>
              <div class="h-10 w-px bg-border/30" />
              <div>
                <div class="text-xl font-semibold text-foreground">
                  {{ props.memInfo ? fmtMb(props.memInfo.totalPssKb / 1024) : "0 MB" }}
                </div>
                <div class="text-[10px] text-muted-foreground/45">Total PSS</div>
              </div>
            </div>
          </div>

          <div
            class="flex items-center gap-2 rounded-full border border-border/25 bg-surface-2/80 px-3 py-1 text-xs"
          >
            <span
              class="h-2 w-2 rounded-full"
              :class="props.isLive ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground/40'"
            />
            <span class="text-muted-foreground/70">
              {{ props.isLive ? "Live 2.5s" : "Stopped" }}
            </span>
            <span v-if="props.memInfo?.pid" class="font-mono text-foreground/80">
              PID {{ props.memInfo.pid }}
            </span>
          </div>
        </div>

        <div class="grid gap-3 p-3">
          <div class="rounded-lg border border-border/20 bg-surface-1 p-3">
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-medium text-foreground/85">
                <Cpu class="h-4 w-4 text-sky-400" />
                CPU timeline
              </div>
              <div class="text-xs text-muted-foreground/45">
                Avg {{ cpuStats.avg.toFixed(1) }}% · Peak {{ cpuStats.max.toFixed(1) }}%
              </div>
            </div>

            <ChartContainer :config="cpuConfig" class="h-[180px] w-full">
              <VisXYContainer
                :data="cpuSeries"
                :margin="{ top: 8, right: 10, bottom: 0, left: 0 }"
                :y-domain="cpuDomain"
              >
                <VisArea
                  :x="xAccessor"
                  :y="cpuY"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-cpu)"
                />
                <VisLine
                  :x="xAccessor"
                  :y="cpuY"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-cpu)"
                />
                <VisAxis type="y" :num-ticks="4" />
                <ChartTooltip :template="cpuTooltip" />
                <ChartCrosshair :template="cpuTooltip" />
              </VisXYContainer>
            </ChartContainer>
          </div>

          <div class="rounded-lg border border-border/20 bg-surface-1 p-3">
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-medium text-foreground/85">
                <MemoryStick class="h-4 w-4 text-amber-400" />
                Native memory
              </div>
              <div class="text-xs text-muted-foreground/45">
                Avg {{ fmtMb(nativeMemoryStats.avg) }} · Peak
                {{ fmtMb(nativeMemoryStats.max) }}
              </div>
            </div>

            <ChartContainer :config="nativeMemoryConfig" class="h-[180px] w-full">
              <VisXYContainer
                :data="nativeMemorySeries"
                :margin="{ top: 8, right: 10, bottom: 0, left: 0 }"
                :y-domain="nativeMemoryDomain"
              >
                <VisArea
                  :x="xAccessor"
                  :y="nativeMemoryY"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-memory)"
                />
                <VisLine
                  :x="xAccessor"
                  :y="nativeMemoryY"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-memory)"
                />
                <VisAxis type="y" :num-ticks="4" />
                <ChartTooltip :template="nativeMemoryTooltip" />
                <ChartCrosshair :template="nativeMemoryTooltip" />
              </VisXYContainer>
            </ChartContainer>
          </div>
        </div>
      </section>

      <section class="overflow-hidden rounded-lg border border-border/25 bg-surface-0">
        <div
          class="flex items-center justify-between gap-4 border-b border-border/20 bg-surface-1 px-3 py-2"
        >
          <div>
            <div class="flex items-center gap-2 text-xs font-medium">
              <Sparkles class="h-3.5 w-3.5" />
              WebView metrics
            </div>
            <div class="mt-2 text-xl font-semibold text-foreground">
              {{ fmtMb(heapStats.now) }}
            </div>
            <div class="mt-1 text-xs text-muted-foreground/45">JS heap in selected target</div>
          </div>

          <div
            class="rounded-full border border-border/25 bg-surface-2/80 px-3 py-1 text-xs"
            :class="webStatusClass"
          >
            {{ webMetrics.status.value }}
          </div>
        </div>

        <div class="grid gap-3 p-3">
          <div class="rounded-lg border border-border/20 bg-surface-1 p-3">
            <div class="mb-3 flex items-center justify-between">
              <div class="flex items-center gap-2 text-sm font-medium text-foreground/85">
                <Database class="h-4 w-4 text-teal-400" />
                JS heap
              </div>
              <div class="text-xs text-muted-foreground/45">Peak {{ fmtMb(heapStats.max) }}</div>
            </div>

            <ChartContainer :config="heapConfig" class="h-[180px] w-full">
              <VisXYContainer
                :data="heapSeries"
                :margin="{ top: 8, right: 10, bottom: 0, left: 0 }"
                :y-domain="heapDomain"
              >
                <VisArea
                  :x="xAccessor"
                  :y="heapUsedY"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-heapUsed)"
                />
                <VisLine
                  :x="xAccessor"
                  :y="heapUsedY"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-heapUsed)"
                />
                <VisLine
                  :x="xAccessor"
                  :y="heapTotalY"
                  :curve-type="CurveType.MonotoneX"
                  color="var(--color-heapTotal)"
                />
                <VisAxis type="y" :num-ticks="4" />
                <ChartTooltip :template="heapTooltip" />
                <ChartCrosshair :template="heapTooltip" />
              </VisXYContainer>
            </ChartContainer>
          </div>

          <div class="grid gap-3 xl:grid-cols-2">
            <div class="rounded-lg border border-border/20 bg-surface-1 p-3">
              <div class="mb-3 flex items-center justify-between">
                <div class="flex items-center gap-2 text-sm font-medium text-foreground/85">
                  <Boxes class="h-4 w-4 text-orange-400" />
                  DOM nodes
                </div>
                <div class="text-xs text-muted-foreground/45">
                  Peak {{ fmtCount(domStats.max) }}
                </div>
              </div>

              <ChartContainer :config="domConfig" class="h-[164px] w-full">
                <VisXYContainer
                  :data="webMetrics.domNodesSeries.value"
                  :margin="{ top: 8, right: 10, bottom: 0, left: 0 }"
                  :y-domain="domDomain"
                >
                  <VisArea
                    :x="xAccessor"
                    :y="domNodesY"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-domNodes)"
                  />
                  <VisLine
                    :x="xAccessor"
                    :y="domNodesY"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-domNodes)"
                  />
                  <VisAxis type="y" :num-ticks="4" />
                  <ChartTooltip :template="domTooltip" />
                  <ChartCrosshair :template="domTooltip" />
                </VisXYContainer>
              </ChartContainer>
            </div>

            <div class="rounded-lg border border-border/20 bg-surface-1 p-3">
              <div class="mb-3 flex items-center justify-between">
                <div class="flex items-center gap-2 text-sm font-medium text-foreground/85">
                  <Network class="h-4 w-4 text-violet-400" />
                  Thread count
                </div>
                <div class="text-xs text-muted-foreground/45">
                  Now {{ fmtCount(threadStats.now) }}
                </div>
              </div>

              <ChartContainer :config="threadConfig" class="h-[164px] w-full">
                <VisXYContainer
                  :data="threadSeries"
                  :margin="{ top: 8, right: 10, bottom: 0, left: 0 }"
                  :y-domain="threadDomain"
                >
                  <VisArea
                    :x="xAccessor"
                    :y="threadY"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-threads)"
                  />
                  <VisLine
                    :x="xAccessor"
                    :y="threadY"
                    :curve-type="CurveType.MonotoneX"
                    color="var(--color-threads)"
                  />
                  <VisAxis type="y" :num-ticks="4" />
                  <ChartTooltip :template="threadTooltip" />
                  <ChartCrosshair :template="threadTooltip" />
                </VisXYContainer>
              </ChartContainer>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
