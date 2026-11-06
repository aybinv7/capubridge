<script setup lang="ts">
import { Button } from "@capubridge/cladd";
import { LANE_META } from "./laneMeta";
import type { MomentItem } from "./momentItems";
import { formatClockMs } from "./stripFormat";

const props = defineProps<{
  items: readonly MomentItem[];
  more: number;
  busyKey: string | null;
}>();

const emit = defineEmits<{
  goto: [item: MomentItem];
}>();
</script>

<template>
  <ol class="flex max-h-72 flex-col overflow-y-auto" aria-label="What happened in this second">
    <li
      v-for="item in props.items"
      :key="item.key"
      class="group flex min-h-7 items-center gap-2 rounded-inner px-1.5 py-1 hover:bg-cladd-surface-hover"
    >
      <span class="shrink-0 font-mono text-2xs text-[var(--fg-subtle)] tabular-nums">
        {{ formatClockMs(item.t).slice(-6) }}
      </span>
      <component
        :is="LANE_META[item.lane].icon"
        class="size-3 shrink-0"
        :class="LANE_META[item.lane].iconClass"
        :aria-label="LANE_META[item.lane].label"
      />
      <span class="flex min-w-0 flex-1 flex-col">
        <span
          class="truncate font-mono text-2xs"
          :class="item.state === 'kept' ? 'text-foreground' : 'text-muted-foreground'"
        >
          {{ item.label || LANE_META[item.lane].label }}
        </span>
        <span v-if="item.note" class="truncate text-2xs text-[var(--fg-subtle)]">{{
          item.note
        }}</span>
      </span>
      <Button
        v-if="item.state === 'kept'"
        size="2xs"
        variant="transparent"
        class="shrink-0 opacity-70 group-hover:opacity-100 focus-visible:opacity-100"
        :loading="props.busyKey === item.key"
        @click="emit('goto', item)"
      >
        Go to
      </Button>
    </li>
    <li v-if="props.more > 0" class="px-1.5 pt-1 text-2xs text-[var(--fg-subtle)]">
      {{ props.more }} more in this second
    </li>
  </ol>
</template>
