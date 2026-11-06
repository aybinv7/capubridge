<script setup lang="ts">
import { computed } from "vue";
import { CircleAlert, Eraser, Pause, Play, RotateCw } from "lucide-vue-next";
import { Button } from "@capubridge/cladd";
import { LOGCAT_LEVELS, LOGCAT_LEVEL_NAMES } from "@/lib/logcat/logcatQuery";
import type { SuggestSource } from "@/lib/stream-query/querySuggest";
import type { QueryProblem } from "@/lib/stream-query/streamQuery.types";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { LogcatLevel } from "@/types/logcat.types";
import ExportAction from "../list/ExportAction.vue";
import LevelSegment from "../list/LevelSegment.vue";
import type { LevelOption } from "../list/streamView.types";
import StreamQueryField from "../list/StreamQueryField.vue";
import StreamStatus from "../list/StreamStatus.vue";
import type { StreamStatusView } from "../list/streamView.types";
import LogsOptions from "./LogsOptions.vue";

/** The Logs controls that sit in the drawer's header: query, levels, state, actions. */
const props = defineProps<{
  suggest: SuggestSource;
  problems: readonly QueryProblem[];
  floor: LogcatLevel | null;
  counts: Readonly<Record<LogcatLevel, number>>;
  status: StreamStatusView;
  tally: string;
  following: boolean;
  exporting: boolean;
}>();

const emit = defineEmits<{
  commit: [query: string];
  floor: [level: string | null];
  follow: [follow: boolean];
  restart: [];
  clear: [];
  export: [format: string];
  showErrors: [];
}>();

const query = defineModel<string>("query", { required: true });

const levels = computed<LevelOption[]>(() =>
  LOGCAT_LEVELS.map((level) => ({
    value: level,
    glyph: level,
    name: LOGCAT_LEVEL_NAMES[level],
    count: props.counts[level],
    tone:
      level === "E" || level === "F"
        ? "error"
        : level === "W"
          ? "warning"
          : level === "I"
            ? "plain"
            : "muted",
  })),
);
const errors = computed(() => props.counts.E + props.counts.F);
const errorLabel = computed(
  () => `${errors.value.toLocaleString()} ${errors.value === 1 ? "error" : "errors"}`,
);

const EXPORTS = [
  { id: "txt", label: "Save as text", detail: "As adb logcat prints it" },
  { id: "json", label: "Save as JSON", detail: "Every field of every line" },
];
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
    <StreamQueryField
      v-model="query"
      class="min-w-48 flex-1 basis-64"
      label="Filter the log"
      placeholder="package:mine level:W tag:… · Ctrl+Space"
      :suggest="props.suggest"
      :problems="props.problems"
      @commit="emit('commit', $event)"
    />
    <LevelSegment
      :options="levels"
      :floor="props.floor"
      label="Lowest level shown"
      @pick="emit('floor', $event)"
    />
    <StreamStatus :status="props.status" :tally="props.tally" />
    <Button
      v-if="errors > 0"
      size="xs"
      variant="transparent"
      :outline="false"
      class="shrink-0 text-error"
      content-class-name="gap-1"
      @click="emit('showErrors')"
    >
      <CircleAlert class="size-3" />
      <span class="tabular-nums">{{ errorLabel }}</span>
    </Button>
    <span class="ml-auto flex shrink-0 items-center gap-0.5">
      <IconAction
        :label="props.following ? 'Stop following new lines' : 'Follow new lines'"
        :hint="props.following ? 'Capture goes on; the list holds still' : undefined"
        :keys="props.following ? undefined : 'end'"
        toggle
        :pressed="!props.following"
        @click="emit('follow', !props.following)"
      >
        <Pause v-if="props.following" :stroke-width="1.8" />
        <Play v-else :stroke-width="1.8" />
      </IconAction>
      <IconAction
        label="Start the capture again"
        hint="Clears the lines and reads the device anew"
        @click="emit('restart')"
      >
        <RotateCw :stroke-width="1.8" />
      </IconAction>
      <IconAction label="Clear the log" keys="ctrl l" @click="emit('clear')">
        <Eraser :stroke-width="1.8" />
      </IconAction>
      <ExportAction
        label="Save the log"
        :choices="EXPORTS"
        :busy="props.exporting"
        @export="emit('export', $event)"
      />
      <LogsOptions />
    </span>
  </div>
</template>
