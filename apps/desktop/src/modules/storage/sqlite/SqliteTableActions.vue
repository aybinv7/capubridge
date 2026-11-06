<script setup lang="ts">
import DataRowMenu from "@/modules/storage/frame/DataRowMenu.vue";
import type { DataAction } from "@/modules/storage/frame/dataFrame.types";

/** The table's menu, at the end of the table's toolbar (Read again sits on the tab strip). */
defineProps<{
  table: string;
  actions: readonly DataAction[];
}>();

const emit = defineEmits<{ action: [id: string] }>();
</script>

<template>
  <DataRowMenu
    v-if="actions.length"
    :actions="actions"
    :label="`Actions for ${table}`"
    @select="emit('action', $event)"
  />
</template>
