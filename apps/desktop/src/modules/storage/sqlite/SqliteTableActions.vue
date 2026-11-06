<script setup lang="ts">
import { RefreshCw } from "lucide-vue-next";
import DataRowMenu from "@/modules/storage/frame/DataRowMenu.vue";
import type { DataAction } from "@/modules/storage/frame/dataFrame.types";
import IconAction from "@/shared/components/presentation/IconAction.vue";

/** Read again and the table's menu, at the end of the table's toolbar. */
defineProps<{
  table: string;
  actions: readonly DataAction[];
  /** An opened file is read again; a copy is copied again and compared. */
  opened: boolean;
}>();

const emit = defineEmits<{ refresh: []; action: [id: string] }>();
</script>

<template>
  <div class="flex shrink-0 items-center gap-0.5">
    <IconAction
      label="Read again"
      :hint="opened ? 'Reads the file again' : 'Copies the database again and compares it'"
      @click="emit('refresh')"
    >
      <RefreshCw :stroke-width="1.8" />
    </IconAction>
    <DataRowMenu
      v-if="actions.length"
      :actions="actions"
      :label="`Actions for ${table}`"
      @select="emit('action', $event)"
    />
  </div>
</template>
