<script setup lang="ts">
import { computed, ref, shallowRef, watchEffect } from "vue";
import { useElementVisibility } from "@vueuse/core";
import { VisArea, VisAxis, VisLine, VisXYContainer } from "@unovis/vue";
import { CurveType } from "@unovis/ts";
import {
  ChartContainer,
  ChartCrosshair,
  ChartTooltip,
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatClock } from "@/shared/format/numbers";
import type { PerfChartLine } from "./perfChart.types";
import { sampleAccessor, seriesYDomain, type SeriesPoint } from "./perfSeries";

const MARGIN = { left: 4, right: 4, top: 6, bottom: 0 };
const DASH = [4, 3];
const CONTAINER_STYLE = {
  "--vis-axis-tick-label-font-size": "11px",
  "--vis-axis-grid-color": "var(--border-subtle)",
};

const props = withDefaults(
  defineProps<{
    /** Builds the points; only called while the chart is on screen. */
    source: () => readonly SeriesPoint[];
    lines: readonly PerfChartLine[];
    yDomain?: [number, number];
    yFormat?: (value: number) => string;
    yTicks?: number;
  }>(),
  { yDomain: undefined, yFormat: undefined, yTicks: 3 },
);

const root = ref<HTMLElement | null>(null);
const visible = useElementVisibility(root);
const series = shallowRef<readonly SeriesPoint[]>([]);

watchEffect(() => {
  if (visible.value) series.value = props.source();
});

const config = computed<ChartConfig>(() =>
  Object.fromEntries(
    props.lines.map((line) => [line.key, { label: line.label, color: line.color }]),
  ),
);
const accessors = computed(() => props.lines.map((line) => sampleAccessor(line.key)));
const domain = computed<[number, number]>(() => {
  if (props.yDomain) return props.yDomain;
  return props.lines.reduce<[number, number]>(
    (acc, line) => [0, Math.max(acc[1], seriesYDomain(series.value, line.key)[1])],
    [0, 1],
  );
});

function timeLabel(point: number | Date): string {
  const time = point instanceof Date ? point.getTime() : point;
  return Number.isFinite(time) ? formatClock(time) : "";
}

function yLabel(point: number | Date): string {
  if (typeof point !== "number" || !Number.isFinite(point)) return "";
  if (props.yFormat) return props.yFormat(point);
  return Math.abs(point) >= 100 ? Math.round(point).toLocaleString() : String(+point.toFixed(1));
}

const tooltip = computed(() =>
  componentToString(config.value, ChartTooltipContent, {
    indicator: "line",
    labelFormatter: timeLabel,
  }),
);
const xAccessor = (point: SeriesPoint) => point.x;
</script>

<template>
  <div ref="root" class="size-full">
    <ChartContainer
      :config="config"
      class="aspect-auto h-full w-full"
      :style="CONTAINER_STYLE"
      cursor
    >
      <VisXYContainer :data="series" :y-domain="domain" :margin="MARGIN" :duration="0">
        <template v-for="(line, index) in props.lines" :key="line.key">
          <VisArea
            v-if="!line.dashed"
            :x="xAccessor"
            :y="accessors[index]"
            :curve-type="CurveType.MonotoneX"
            :color="`var(--color-${line.key})`"
            :opacity="0.1"
            :duration="0"
          />
          <VisLine
            :x="xAccessor"
            :y="accessors[index]"
            :curve-type="CurveType.MonotoneX"
            :color="`var(--color-${line.key})`"
            :line-width="1.5"
            :line-dash-array="line.dashed ? DASH : undefined"
            :duration="0"
          />
        </template>
        <VisAxis
          type="y"
          :num-ticks="props.yTicks"
          :tick-format="yLabel"
          :tick-line="false"
          :domain-line="false"
          :duration="0"
        />
        <VisAxis
          type="x"
          :num-ticks="3"
          :tick-format="timeLabel"
          :tick-line="false"
          :domain-line="false"
          :grid-line="false"
          :duration="0"
        />
        <ChartTooltip :template="tooltip" />
        <ChartCrosshair :template="tooltip" />
      </VisXYContainer>
    </ChartContainer>
  </div>
</template>
