<script setup lang="ts">
import { computed, ref } from "vue";
import { refDebounced } from "@vueuse/core";
import { Button, SearchField } from "@capubridge/cladd";
import type { SahPoolDatabase } from "@capubridge/cdp-protocol";
import { DataGrid, type GridContextAction } from "@/shared/components/data/grid";
import DataState from "@/modules/storage/frame/DataState.vue";
import { POOL_COLUMNS, poolGridRow, shownPool } from "./opfsPoolGrid";

/**
 * The databases a SQLite SAH-Pool keeps in this folder, decoded from each slot's header: the
 * name the app opens it by, the slot that holds it, its size and flags. Enter opens one in the
 * SQLite tab without its 4 KB slot header.
 */
const props = defineProps<{
  databases: readonly SahPoolDatabase[];
  loading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{ open: [database: SahPoolDatabase]; retry: [] }>();

const find = ref("");
const findText = refDebounced(find, 150);
const shown = computed(() => shownPool(props.databases, findText.value));
const rows = computed(() => shown.value.map((database) => poolGridRow(database)));
const byId = computed(
  () => new Map(props.databases.map((database) => [database.opaquePath, database])),
);

function open(id: string) {
  const database = byId.value.get(id);
  if (database) emit("open", database);
}

function contextActions(): GridContextAction[] {
  return [{ id: "open", label: "Open in Data › SQLite" }];
}
</script>

<template>
  <DataState
    v-if="error && databases.length === 0"
    kind="error"
    title="Could not decode the SAH-Pool; the folder may not be in pool format"
    :detail="error"
    @retry="emit('retry')"
  />
  <template v-else>
    <div class="flex shrink-0 items-center gap-1.5 px-3 py-2">
      <SearchField
        v-model="find"
        size="sm"
        class="w-60 min-w-36 shrink"
        placeholder="Find a database or slot"
        aria-label="Find a database or slot"
      />
    </div>
    <div class="min-h-0 flex-1 px-2 pb-2">
      <DataGrid
        label="Databases in the SAH-Pool"
        :columns="POOL_COLUMNS"
        :rows="rows"
        :loading="loading"
        read-only
        activate-rows
        :column-features="{ filter: false, group: false, showAs: false }"
        :context-actions="contextActions"
        layout-key="opfs-sah-pool"
        @activate="open"
        @context-action="(_action, target) => target.rowId && open(target.rowId)"
      >
        <template #empty>
          <div v-if="findText.trim()" class="flex flex-col items-start gap-2">
            <span>No database is named “{{ findText.trim() }}”.</span>
            <Button size="sm" variant="transparent" @click="find = ''">Clear find</Button>
          </div>
          <span v-else>No live databases in this pool: every slot is empty.</span>
        </template>
      </DataGrid>
    </div>
  </template>
</template>
