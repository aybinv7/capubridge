<script setup lang="ts">
import { computed, ref, shallowRef, watch } from "vue";
import { Checkbox, Dialog, SearchField, Segmented, SegmentedButton } from "@capubridge/cladd";
import { LIVE_COST } from "@/modules/storage/useLiveSqlite";
import type { SqliteTableInfo } from "@/types/sqlite.types";
import type { TableChange } from "../opfsSqliteQuestions";
import SqliteTablePickList from "./SqliteTablePickList.vue";
import type { TablePick, TablePickRequest } from "./useSqliteTablePick";

const open = defineModel<boolean>("open", { required: true });

const props = defineProps<{ request: TablePickRequest | null }>();

const emit = defineEmits<{ choose: [pick: TablePick] }>();

const CHANGES: { value: TableChange; label: string }[] = [
  { value: "empty", label: "Delete rows" },
  { value: "drop", label: "Drop tables" },
];

const change = ref<TableChange>("empty");
const filter = ref("");
const picked = shallowRef<ReadonlySet<string>>(new Set());

watch(
  () => props.request,
  () => {
    change.value = "empty";
    filter.value = "";
    picked.value = new Set();
  },
);

const tables = computed(() => props.request?.tables ?? []);

const shown = computed(() => {
  const needle = filter.value.trim().toLowerCase();
  return needle
    ? tables.value.filter((table) => table.name.toLowerCase().includes(needle))
    : tables.value;
});

function blockedReason(table: SqliteTableInfo): string | null {
  return change.value === "empty" && table.tableType === "view"
    ? "A view holds no rows of its own"
    : null;
}

const pickable = computed(() => shown.value.filter((table) => blockedReason(table) === null));

const chosen = computed(() =>
  tables.value.filter((table) => picked.value.has(table.name) && blockedReason(table) === null),
);

const allShown = computed(
  () => pickable.value.length > 0 && pickable.value.every((table) => picked.value.has(table.name)),
);

const rows = computed(() => chosen.value.reduce((sum, table) => sum + table.rowCount, 0));

function toggle(name: string, on: boolean) {
  const next = new Set(picked.value);
  if (on) next.add(name);
  else next.delete(name);
  picked.value = next;
}

function toggleShown(on: boolean) {
  const next = new Set(picked.value);
  for (const table of pickable.value) {
    if (on) next.add(table.name);
    else next.delete(table.name);
  }
  picked.value = next;
}

const count = (value: number) => value.toLocaleString("en-US");

const confirmLabel = computed(() => {
  const n = chosen.value.length;
  if (n === 0) return "Pick tables first";
  const tablesWord = `${count(n)} ${n === 1 ? "table" : "tables"}`;
  return change.value === "empty" ? `Delete rows of ${tablesWord}` : `Drop ${tablesWord}`;
});

const summary = computed(() => {
  const n = chosen.value.length;
  if (n === 0) return `${count(tables.value.length)} tables and views`;
  return change.value === "empty"
    ? `${count(n)} picked, ${count(rows.value)} rows go`
    : `${count(n)} picked, they leave the database with ${count(rows.value)} rows`;
});

function confirm() {
  emit("choose", { change: change.value, tables: chosen.value });
}
</script>

<template>
  <Dialog
    v-model:open="open"
    data-overlay
    :title="props.request ? `Empty or drop tables of “${props.request.database}”` : undefined"
    :confirm-button-text="confirmLabel"
    cancel-button-text="Cancel"
    confirm-button-color="red"
    class="w-[560px] max-w-[calc(100vw-48px)]"
    @confirm="confirm"
  >
    <div class="flex flex-col gap-3">
      <Segmented size="sm" active-variant="solid" aria-label="Change" class="self-start">
        <SegmentedButton
          v-for="option in CHANGES"
          :key="option.value"
          :active="change === option.value"
          @click="change = option.value"
        >
          {{ option.label }}
        </SegmentedButton>
      </Segmented>
      <div class="flex items-center gap-3">
        <SearchField
          v-model="filter"
          size="sm"
          placeholder="Find a table"
          aria-label="Find a table"
          class="min-w-0 flex-1"
        />
        <label class="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-foreground">
          <Checkbox
            size="sm"
            :checked="allShown"
            :disabled="pickable.length === 0"
            @update:checked="toggleShown"
          />
          {{ filter.trim() ? "All shown" : "All" }}
        </label>
      </div>
      <SqliteTablePickList
        :tables="shown"
        :picked="picked"
        :blocked-reason="blockedReason"
        @toggle="toggle"
      />
      <p class="text-2xs text-muted-foreground tabular-nums">{{ summary }}</p>
      <p class="text-xs leading-relaxed text-muted-foreground">
        {{ LIVE_COST }} A copy of the database as it was is kept on this computer.
      </p>
    </div>
  </Dialog>
</template>
