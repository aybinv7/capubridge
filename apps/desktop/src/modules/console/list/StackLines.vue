<script setup lang="ts">
import { computed, ref } from "vue";
import { Link } from "@capubridge/cladd";
import { foldStack, type StackLine } from "@/lib/stream-rows/foldStack";

/**
 * A stack, folded after its first run of app frames. App frames read in the foreground,
 * framework and library frames are muted, and "N more frames" opens the rest.
 */
const props = defineProps<{ lines: readonly StackLine[] }>();

const unfolded = ref(false);
const segments = computed(() =>
  unfolded.value
    ? props.lines.map((line) => ({ kind: "line" as const, line }))
    : foldStack(props.lines),
);
const hidden = computed(() =>
  segments.value.reduce((sum, segment) => sum + (segment.kind === "fold" ? segment.count : 0), 0),
);

function tone(line: StackLine): string {
  if (!line.frame) return "text-foreground";
  return line.app ? "text-foreground font-medium" : "text-[var(--fg-subtle)]";
}
</script>

<template>
  <div class="font-mono text-xs leading-5 whitespace-pre-wrap break-all">
    <template v-for="(segment, index) in segments" :key="index">
      <div v-if="segment.kind === 'line'" :class="tone(segment.line)">{{ segment.line.text }}</div>
      <Link v-else class="block w-fit pl-4 text-2xs" @click="unfolded = true">
        {{ segment.count }} more {{ segment.count === 1 ? "frame" : "frames" }}
      </Link>
    </template>
    <Link
      v-if="unfolded && hidden === 0 && props.lines.length > 0"
      class="text-2xs"
      @click="unfolded = false"
    >
      Fold the framework frames
    </Link>
  </div>
</template>
