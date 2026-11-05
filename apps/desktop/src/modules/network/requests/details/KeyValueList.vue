<script setup lang="ts">
export interface KeyValueRow {
  key: string;
  value: string;
  tone?: string;
  clamp?: boolean;
}

const props = defineProps<{ rows: readonly KeyValueRow[]; mono?: boolean }>();
</script>

<template>
  <dl class="grid grid-cols-[minmax(6rem,11rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
    <template v-for="(row, index) in props.rows" :key="`${row.key}-${index}`">
      <dt
        class="truncate text-muted-foreground"
        :class="props.mono && 'font-mono text-2xs leading-4'"
        :title="row.key"
      >
        {{ row.key }}
      </dt>
      <dd
        class="min-w-0 break-all select-text"
        :class="[
          props.mono && 'font-mono text-2xs leading-4',
          row.tone ?? 'text-foreground',
          row.clamp && 'line-clamp-4',
        ]"
        :title="row.clamp ? row.value : undefined"
      >
        {{ row.value }}
      </dd>
    </template>
  </dl>
</template>
