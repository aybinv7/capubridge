<script setup lang="ts">
import { computed } from "vue";
import { Eraser, Pause, Play } from "lucide-vue-next";
import { Segmented, SegmentedButton } from "@capubridge/cladd";
import { CONSOLE_LEVELS, CONSOLE_LEVEL_NAMES } from "@/lib/console/consoleQuery";
import type { ConsoleLevelCounts } from "@/lib/console/consoleBuffer";
import type { SuggestSource } from "@/lib/stream-query/querySuggest";
import type { QueryProblem } from "@/lib/stream-query/streamQuery.types";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { ConsoleMode } from "@/types/drawer.types";
import LevelSegment from "../list/LevelSegment.vue";
import type { LevelOption } from "../list/streamView.types";
import StreamQueryField from "../list/StreamQueryField.vue";
import StreamStatus from "../list/StreamStatus.vue";
import type { StreamStatusView } from "../list/streamView.types";

/** The Console controls in the drawer's header: query, levels, Stream or Errors, state, actions. */
const props = defineProps<{
  suggest: SuggestSource;
  problems: readonly QueryProblem[];
  floor: number | null;
  counts: ConsoleLevelCounts;
  errorCount: number;
  mode: ConsoleMode;
  status: StreamStatusView;
  tally: string;
  following: boolean;
}>();

const emit = defineEmits<{
  commit: [query: string];
  floor: [level: string | null];
  mode: [mode: ConsoleMode];
  follow: [follow: boolean];
  clear: [];
}>();

const query = defineModel<string>("query", { required: true });

const GLYPHS = { verbose: "V", info: "I", warn: "W", error: "E" } as const;
const TONES = { verbose: "muted", info: "plain", warn: "warning", error: "error" } as const;

const levels = computed<LevelOption[]>(() =>
  CONSOLE_LEVELS.map((level) => ({
    value: level,
    glyph: GLYPHS[level],
    name: CONSOLE_LEVEL_NAMES[level],
    count: props.counts[level],
    tone: TONES[level],
  })),
);
const floorValue = computed(() =>
  props.floor === null ? null : (CONSOLE_LEVELS[props.floor] ?? null),
);
const count = new Intl.NumberFormat();
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
    <Segmented
      size="xs"
      active-variant="solid"
      aria-label="What the console lists"
      class="shrink-0"
    >
      <SegmentedButton :active="props.mode === 'stream'" @click="emit('mode', 'stream')">
        Stream
      </SegmentedButton>
      <SegmentedButton
        :active="props.mode === 'errors'"
        content-class-name="gap-1"
        @click="emit('mode', 'errors')"
      >
        Errors
        <span v-if="props.errorCount > 0" class="font-mono text-2xs text-error tabular-nums">
          {{ count.format(props.errorCount) }}
        </span>
      </SegmentedButton>
    </Segmented>
    <StreamQueryField
      v-model="query"
      class="min-w-48 flex-1 basis-64"
      label="Filter the console"
      placeholder="level:warn -url:vendor /timeout/ · Ctrl+Space"
      :suggest="props.suggest"
      :problems="props.problems"
      @commit="emit('commit', $event)"
    />
    <LevelSegment
      v-if="props.mode === 'stream'"
      :options="levels"
      :floor="floorValue"
      label="Lowest level shown"
      @pick="emit('floor', $event)"
    />
    <StreamStatus :status="props.status" :tally="props.tally" />
    <span class="ml-auto flex shrink-0 items-center gap-0.5">
      <IconAction
        v-if="props.mode === 'stream'"
        :label="props.following ? 'Stop following new messages' : 'Follow new messages'"
        :hint="props.following ? 'Capture goes on; the list holds still' : undefined"
        :keys="props.following ? undefined : 'end'"
        toggle
        :pressed="!props.following"
        @click="emit('follow', !props.following)"
      >
        <Pause v-if="props.following" :stroke-width="1.8" />
        <Play v-else :stroke-width="1.8" />
      </IconAction>
      <IconAction label="Clear the console" keys="ctrl l" @click="emit('clear')">
        <Eraser :stroke-width="1.8" />
      </IconAction>
    </span>
  </div>
</template>
