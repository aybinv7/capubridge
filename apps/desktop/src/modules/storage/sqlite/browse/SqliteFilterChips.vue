<script setup lang="ts">
import { X } from "lucide-vue-next";
import { Chip } from "@capubridge/cladd";
import HintTooltip from "@/shared/components/presentation/HintTooltip.vue";
import IconAction from "@/shared/components/presentation/IconAction.vue";
import type { SqliteFilterChip } from "./sqliteFilters";

/**
 * Every active filter, always on screen: one chip per condition and one for the free WHERE.
 * A WHERE the database refused turns red, with the database's words on hover.
 */
defineProps<{
  filters: readonly SqliteFilterChip[];
  where: string;
  /** Why the filters did not run, from the database. */
  error: string | null;
}>();

const emit = defineEmits<{ remove: [id: string]; clearWhere: [] }>();
</script>

<template>
  <ul
    v-if="filters.length || where"
    class="flex min-w-0 flex-wrap items-center gap-1"
    aria-label="Active filters"
  >
    <li v-for="chip in filters" :key="chip.id">
      <Chip size="xl" content-class-name="gap-1 pr-0.5">
        <HintTooltip :text="chip.sql">
          <span class="max-w-56 truncate font-mono text-2xs" tabindex="0">{{ chip.label }}</span>
        </HintTooltip>
        <IconAction
          size="xs"
          :label="`Remove the filter ${chip.label}`"
          @click="emit('remove', chip.id)"
        >
          <X :stroke-width="1.8" />
        </IconAction>
      </Chip>
    </li>
    <li v-if="where">
      <Chip size="xl" :color="error ? 'red' : undefined" content-class-name="gap-1 pr-0.5">
        <HintTooltip :text="error ? `The database refused it: ${error}` : where">
          <span class="max-w-72 truncate font-mono text-2xs" tabindex="0">WHERE {{ where }}</span>
        </HintTooltip>
        <IconAction size="xs" label="Remove the WHERE clause" @click="emit('clearWhere')">
          <X :stroke-width="1.8" />
        </IconAction>
      </Chip>
    </li>
  </ul>
</template>
