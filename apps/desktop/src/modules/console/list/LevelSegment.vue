<script setup lang="ts">
import { Segmented, SegmentedButton, Tooltip } from "@capubridge/cladd";
import type { LevelOption } from "./streamView.types";

/**
 * Level chips that mirror the query's `level:` floor: the chip of the floor is pressed, and
 * picking one rewrites the query. The lowest level means every level.
 */
const props = defineProps<{
  options: readonly LevelOption[];
  floor: string | null;
  label: string;
}>();

const emit = defineEmits<{ pick: [value: string | null] }>();

const count = new Intl.NumberFormat(undefined, { notation: "compact" });

const TONES: Record<LevelOption["tone"], string> = {
  error: "text-error",
  warning: "text-warning",
  plain: "text-foreground",
  muted: "text-[var(--fg-subtle)]",
};

function isActive(option: LevelOption, index: number): boolean {
  return props.floor === null ? index === 0 : option.value === props.floor;
}

/**
 * Read through `props` inside the tooltip trigger: Cladd renders the trigger in its own
 * component, which only follows reactive reads, not the loop variable.
 */
function countAt(index: number): number {
  return props.options[index]?.count ?? 0;
}

function pick(option: LevelOption, index: number) {
  emit("pick", index === 0 || isActive(option, index) ? null : option.value);
}
</script>

<template>
  <Segmented size="xs" active-variant="solid" :aria-label="props.label" class="shrink-0">
    <Tooltip
      v-for="(option, index) in props.options"
      :key="option.value"
      position="bottom"
      :offset="6"
      content-class-name="px-2 py-1 text-xs"
    >
      <template #trigger>
        <SegmentedButton
          :active="isActive(option, index)"
          :aria-label="index === 0 ? `Every level` : `${option.name} and above`"
          content-class-name="gap-1 px-1.5 font-mono"
          @click="pick(option, index)"
        >
          <span :class="TONES[option.tone]">{{ option.glyph }}</span>
          <span
            v-if="countAt(index) > 0"
            class="text-2xs tabular-nums"
            :class="option.tone === 'error' ? 'text-error' : 'text-[var(--fg-subtle)]'"
          >
            {{ count.format(countAt(index)) }}
          </span>
        </SegmentedButton>
      </template>
      {{
        index === 0
          ? `Every level, from ${option.name.toLowerCase()} up`
          : `${option.name} and above`
      }}
    </Tooltip>
  </Segmented>
</template>
