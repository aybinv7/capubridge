<script setup lang="ts">
import { Link } from "@capubridge/cladd";
import { TONE_CLASS, type CellTone } from "./tone";

export interface KeyValueRow {
  key: string;
  value: string;
  tone?: CellTone;
  clamp?: boolean;
  /** Makes the value a link that shows where this fact is told in full. */
  action?: () => void;
}

const props = defineProps<{ rows: readonly KeyValueRow[]; mono?: boolean }>();
</script>

<template>
  <dl class="grid grid-cols-[minmax(6rem,11rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
    <template v-for="(row, index) in props.rows" :key="`${row.key}-${index}`">
      <dt
        class="truncate text-muted-foreground"
        :class="props.mono && 'font-mono leading-4'"
        :title="row.key"
      >
        {{ row.key }}
      </dt>
      <dd class="min-w-0" :class="props.mono && 'font-mono leading-4'">
        <Link
          v-if="row.action"
          class="text-foreground underline decoration-border underline-offset-2 hover:decoration-current"
          @click="row.action()"
        >
          {{ row.value }}
        </Link>
        <span
          v-else
          class="block break-all select-text"
          :class="[TONE_CLASS[row.tone ?? 'default'], row.clamp && 'line-clamp-2']"
          :title="row.clamp ? row.value : undefined"
        >
          {{ row.value }}
        </span>
      </dd>
    </template>
  </dl>
</template>
