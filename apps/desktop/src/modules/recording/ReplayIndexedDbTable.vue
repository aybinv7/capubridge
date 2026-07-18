<script setup lang="ts">
import { computed, shallowRef } from "vue";
import { Eye } from "lucide-vue-next";
import type { IDBRecord } from "@capubridge/cdp-protocol";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import JsonViewer from "@/shared/components/data/JsonViewer.vue";

type ReplayRecord = IDBRecord & {
  __changeOperation?: "add" | "update" | "delete";
  __changeDeleted?: boolean;
};

const props = defineProps<{
  records: IDBRecord[];
  isLoading: boolean;
}>();

const selectedRecord = shallowRef<IDBRecord | null>(null);
const rows = computed(() => props.records.slice(0, 50));

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function operation(record: IDBRecord) {
  return (record as ReplayRecord).__changeOperation ?? null;
}

function rowClass(record: IDBRecord) {
  switch (operation(record)) {
    case "add":
      return "bg-emerald-500/10";
    case "update":
      return "bg-amber-500/10";
    case "delete":
      return "bg-red-500/10 opacity-70";
    default:
      return "hover:bg-surface-2/70";
  }
}
</script>

<template>
  <div class="min-h-0 flex-1 overflow-auto">
    <div
      v-if="isLoading"
      class="flex h-full items-center justify-center text-xs text-muted-foreground/40"
    >
      Loading rows…
    </div>
    <div
      v-else-if="rows.length === 0"
      class="flex h-full items-center justify-center text-xs text-muted-foreground/40"
    >
      No rows captured
    </div>
    <table v-else class="w-full table-fixed border-collapse text-left text-xs">
      <thead class="sticky top-0 z-10 bg-surface-1 text-[10px] uppercase text-muted-foreground/50">
        <tr>
          <th class="w-1/3 border-b border-border/30 px-3 py-2 font-medium">Key</th>
          <th class="border-b border-border/30 px-3 py-2 font-medium">Value</th>
          <th class="w-20 border-b border-border/30 px-3 py-2 font-medium">State</th>
          <th class="w-12 border-b border-border/30 px-3 py-2" />
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(record, index) in rows"
          :key="`${displayValue(record.key)}:${index}`"
          class="border-b border-border/15 transition-colors"
          :class="rowClass(record)"
        >
          <td class="truncate px-3 py-2 font-mono text-info/80" :title="displayValue(record.key)">
            {{ displayValue(record.key) }}
          </td>
          <td
            class="truncate px-3 py-2 font-mono text-foreground/70"
            :title="displayValue(record.value)"
          >
            {{ displayValue(record.value) }}
          </td>
          <td class="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground/60">
            {{ operation(record) ?? "snapshot" }}
          </td>
          <td class="px-2 py-1.5">
            <button
              type="button"
              class="flex size-7 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-surface-3 hover:text-foreground"
              aria-label="Inspect record"
              @click="selectedRecord = record"
            >
              <Eye :size="13" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <Dialog
    :open="selectedRecord !== null"
    @update:open="(open) => (open ? null : (selectedRecord = null))"
  >
    <DialogContent class="flex h-[75vh] w-[80vw] max-w-[80vw] flex-col gap-0 p-0">
      <DialogHeader class="shrink-0 border-b border-border/30 px-5 py-3">
        <DialogTitle class="truncate font-mono text-sm">
          {{ selectedRecord ? displayValue(selectedRecord.key) : "Record" }}
        </DialogTitle>
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-hidden">
        <JsonViewer v-if="selectedRecord" :value="selectedRecord.value" />
      </div>
    </DialogContent>
  </Dialog>
</template>
