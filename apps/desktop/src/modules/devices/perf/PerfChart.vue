<script setup lang="ts">
import { computed } from "vue";
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
import { formatClock } from "../shared/format";
import type { PerfChartLine } from "./perfChart.types";
import { sampleAccessor, seriesYDomain, tickTimestamp, type SeriesPoint } from "./perfSeries";

const props = withDefaults(
  defineProps<{
    series: readonly SeriesPoint[];
    lines: readonly PerfChartLine[];
    latestTimestamp: number | null;
    yDomain?: [number, number];
    yFormat?: (value: number) => string;
  }>(),
  { yDomain: undefined, yFormat: undefined },
);

const config = computed<ChartConfig>(() =>
  Object.fromEntries(
    props.lines.map((line) => [line.key, { label: line.label, color: line.color }]),
  ),
);
const accessors = computed(() => props.lines.map((line) => sampleAccessor(line.key)));
const domain = computed<[number, number]>(() => {
  if (props.yDomain) return props.yDomain;
  return props.lines.reduce<[number, number]>(
    (acc, line) => {
      const [, max] = seriesYDomain(props.series, line.key);
      return [0, Math.max(acc[1], max)];
    },
    [0, 1],
  );
});
const latestX = computed(() => props.series.at(-1)?.x ?? 0);

function timeLabel(point: number | Date): string {
  if (point instanceof Date) return formatClock(point.getTime());
  const timestamp = tickTimestamp(point, latestX.value, props.latestTimestamp);
  return timestamp === null ? "" : formatClock(timestamp);
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
  <ChartContainer
    :config="config"
    class="aspect-auto h-full w-full"
    :style="{
      '--vis-axis-tick-label-font-size': '11px',
      '--vis-axis-grid-color': 'var(--border-subtle)',
    }"
    cursor
  >
    <VisXYContainer
      :data="props.series"
      :y-domain="domain"
      :margin="{ left: 4, right: 4, top: 6, bottom: 0 }"
    >
      <template v-for="(line, index) in props.lines" :key="line.key">
        <VisArea
          v-if="!line.dashed"
          :x="xAccessor"
          :y="accessors[index]"
          :curve-type="CurveType.MonotoneX"
          :color="`var(--color-${line.key})`"
          :opacity="0.1"
        />
        <VisLine
          :x="xAccessor"
          :y="accessors[index]"
          :curve-type="CurveType.MonotoneX"
          :color="`var(--color-${line.key})`"
          :line-width="1.5"
          :line-dash-array="line.dashed ? [4, 3] : undefined"
        />
      </template>
      <VisAxis
        type="y"
        :num-ticks="3"
        :tick-format="yLabel"
        :tick-line="false"
        :domain-line="false"
      />
      <VisAxis
        type="x"
        :num-ticks="3"
        :tick-format="timeLabel"
        :tick-line="false"
        :domain-line="false"
        :grid-line="false"
      />
      <ChartTooltip :template="tooltip" />
      <ChartCrosshair :template="tooltip" />
    </VisXYContainer>
  </ChartContainer>
</template>
