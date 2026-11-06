<script setup lang="ts">
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Group, X } from "lucide-vue-next";
import { Button, Popover } from "@capubridge/cladd";
import { computed } from "vue";
import { OPEN_ALL_LIMIT, type SqliteGroupRows } from "./useSqliteGroupRows";

/** The grouping chip: names the grouped column, opens or closes every group, or stops grouping. */
const props = defineProps<{
  column: string;
  groups: SqliteGroupRows;
}>();

const emit = defineEmits<{ stop: [] }>();

const openable = computed(() => Math.min(props.groups.groupCount.value, OPEN_ALL_LIMIT));
const openLabel = computed(() =>
  props.groups.groupCount.value > OPEN_ALL_LIMIT
    ? `Open the first ${OPEN_ALL_LIMIT} groups`
    : "Open all groups",
);

function run(action: () => void, close: () => void) {
  action();
  close();
}
</script>

<template>
  <Popover position="bottom-start" content-class-name="w-56 p-1">
    <template #trigger>
      <Button
        size="sm"
        variant="solid"
        content-class-name="gap-1.5"
        :aria-label="`Grouped by ${column}: open the grouping menu`"
      >
        <Group :size="13" aria-hidden="true" />
        <span class="font-mono">{{ column }}</span>
        <ChevronDown :size="12" aria-hidden="true" class="text-cladd-fg-soft" />
      </Button>
    </template>
    <template #default="{ close }">
      <div class="flex flex-col">
        <p class="px-2 pt-2 pb-1 text-cladd-2xs text-cladd-fg-softer">
          {{ props.groups.openCount.value }} of {{ props.groups.groupCount.value }} groups open on
          this page
        </p>
        <Button
          size="sm"
          variant="transparent"
          :outline="false"
          content-class-name="w-full justify-start gap-2"
          :disabled="props.groups.openCount.value >= openable"
          @click="run(props.groups.openAll, close)"
        >
          <ChevronsUpDown :size="13" aria-hidden="true" />
          {{ openLabel }}
        </Button>
        <Button
          size="sm"
          variant="transparent"
          :outline="false"
          content-class-name="w-full justify-start gap-2"
          :disabled="props.groups.openCount.value === 0"
          @click="run(props.groups.closeAll, close)"
        >
          <ChevronsDownUp :size="13" aria-hidden="true" />
          Close all groups
        </Button>
        <div class="my-1 border-t border-cladd-outline" />
        <Button
          size="sm"
          variant="transparent"
          :outline="false"
          content-class-name="w-full justify-start gap-2"
          @click="run(() => emit('stop'), close)"
        >
          <X :size="13" aria-hidden="true" />
          Stop grouping
        </Button>
      </div>
    </template>
  </Popover>
</template>
