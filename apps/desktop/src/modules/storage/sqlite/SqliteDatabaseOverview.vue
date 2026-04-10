<script setup lang="ts">
import { computed, ref } from "vue";
import { Database, Table2, RefreshCw, Loader2, ChevronRight, AlertCircle } from "lucide-vue-next";
import type { SqliteTableInfo, SqliteColumnInfo, SqliteIndexInfo } from "@/types/sqlite.types";

const props = defineProps<{
  dbName: string;
  dbPath?: string;
  dbSize?: number;
  tables: SqliteTableInfo[];
  isLoading: boolean;
  isError?: boolean;
  packageName?: string;
}>();

const emit = defineEmits<{
  selectTable: [name: string];
  refresh: [];
}>();

// Stats
const totalRows = computed(() => props.tables.reduce((sum, t) => sum + t.rowCount, 0));
const tableCount = computed(() => props.tables.filter((t) => t.tableType === "table").length);
const viewCount = computed(() => props.tables.filter((t) => t.tableType === "view").length);
const maxRows = computed(() => Math.max(...props.tables.map((t) => t.rowCount), 1));

const sortedTables = computed(() => [...props.tables].sort((a, b) => b.rowCount - a.rowCount));
const nonEmptyTables = computed(() => sortedTables.value.filter((t) => t.rowCount > 0));

function barPct(count: number): string {
  return `${Math.max(2, (count / maxRows.value) * 100).toFixed(1)}%`;
}

function fmtNum(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

function formatBytes(bytes: number | undefined | null): string {
  if (bytes == null) return "—";
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Expanded tables for column/index detail
const expandedTables = ref(new Set<string>());

function toggleExpanded(tableName: string, e: Event) {
  e.stopPropagation();
  const next = new Set(expandedTables.value);
  if (next.has(tableName)) {
    next.delete(tableName);
  } else {
    next.add(tableName);
  }
  expandedTables.value = next;
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- Top bar -->
    <div class="shrink-0 flex items-center gap-2.5 px-4 h-9 border-b border-border/20 bg-surface-1">
      <Database :size="13" class="text-muted-foreground/50 shrink-0" />
      <span class="font-mono text-xs text-foreground/90 truncate min-w-0 font-medium">{{
        dbName
      }}</span>
      <span
        class="shrink-0 font-mono text-[10px] text-muted-foreground/50 bg-surface-3 px-1.5 py-0.5 rounded"
        :title="dbPath"
      >
        {{ formatBytes(dbSize) }}
      </span>
      <span
        v-if="packageName"
        class="shrink-0 font-mono text-[10px] text-muted-foreground/40 truncate max-w-[200px]"
      >
        {{ packageName }}
      </span>
      <button
        class="ml-auto shrink-0 p-1 rounded hover:bg-surface-3 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
        title="Refresh"
        @click="emit('refresh')"
      >
        <RefreshCw :size="11" />
      </button>
    </div>

    <!-- Stats strip -->
    <div
      class="shrink-0 flex items-stretch border-b border-border/20 bg-surface-0 divide-x divide-border/20"
    >
      <div class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span class="font-mono text-base font-semibold text-foreground/90">{{
          fmtNum(tableCount)
        }}</span>
        <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50">Tables</span>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span class="font-mono text-base font-semibold text-foreground/90">{{
          fmtNum(viewCount)
        }}</span>
        <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50">Views</span>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span class="font-mono text-base font-semibold text-foreground/90">{{
          fmtNum(totalRows)
        }}</span>
        <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50">Rows</span>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span class="font-mono text-base font-semibold text-foreground/90">{{
          formatBytes(dbSize)
        }}</span>
        <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50">Size</span>
      </div>
    </div>

    <!-- Scrollable body -->
    <div class="flex-1 overflow-auto min-h-0">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center h-32">
        <Loader2 :size="14" class="animate-spin text-muted-foreground/30" />
      </div>

      <!-- Error -->
      <div v-else-if="isError" class="flex flex-col items-center justify-center h-32 gap-2">
        <AlertCircle :size="16" class="text-muted-foreground/25" />
        <p class="text-xs text-muted-foreground/50">Failed to load database info</p>
        <button
          class="text-xs text-info/70 hover:text-info transition-colors"
          @click="emit('refresh')"
        >
          Retry
        </button>
      </div>

      <!-- Empty -->
      <div
        v-else-if="tables.length === 0"
        class="flex flex-col items-center justify-center h-32 gap-2"
      >
        <Database :size="16" class="text-muted-foreground/20" />
        <p class="text-xs text-muted-foreground/40">No tables found</p>
      </div>

      <template v-else>
        <!-- Distribution chart -->
        <div v-if="nonEmptyTables.length > 0" class="border-b border-border/20 px-4 py-3">
          <p
            class="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-2.5 font-medium"
          >
            By row count
          </p>
          <div class="flex flex-col gap-1.5">
            <div
              v-for="table in nonEmptyTables.slice(0, 10)"
              :key="table.name"
              class="flex items-center gap-2 group cursor-pointer"
              @click="emit('selectTable', table.name)"
            >
              <span
                class="w-32 truncate text-right font-mono text-[11px] text-muted-foreground/60 group-hover:text-foreground/70 transition-colors shrink-0"
                :title="table.name"
                >{{ table.name }}</span
              >
              <div class="flex-1 h-[3px] bg-surface-3 rounded-full overflow-hidden">
                <div
                  class="h-full bg-info/50 group-hover:bg-info/70 rounded-full transition-all duration-300"
                  :style="{ width: barPct(table.rowCount) }"
                />
              </div>
              <span class="w-12 text-right font-mono text-[11px] text-muted-foreground/55 shrink-0">
                {{ fmtNum(table.rowCount) }}
              </span>
            </div>
            <p
              v-if="nonEmptyTables.length > 10"
              class="text-[9px] text-muted-foreground/30 text-right font-mono mt-0.5"
            >
              +{{ nonEmptyTables.length - 10 }} more
            </p>
          </div>
        </div>

        <!-- Table list with schema detail -->
        <table class="w-full text-xs border-collapse">
          <thead class="sticky top-0 z-10 bg-surface-1 border-b border-border/20">
            <tr class="text-left">
              <th class="px-3 py-2.5 w-6"></th>
              <th
                class="px-2 py-2.5 font-medium text-[9px] uppercase tracking-widest text-muted-foreground/50"
              >
                Table
              </th>
              <th
                class="px-2 py-2.5 font-medium text-[9px] uppercase tracking-widest text-muted-foreground/50 text-right w-32"
              >
                Rows
              </th>
              <th
                class="px-2 py-2.5 font-medium text-[9px] uppercase tracking-widest text-muted-foreground/50 text-center w-16"
              >
                Type
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="table in sortedTables" :key="table.name">
              <!-- Table row -->
              <tr
                class="group cursor-pointer border-b border-border/10 hover:bg-surface-2/70 transition-colors"
                @click="emit('selectTable', table.name)"
              >
                <td class="px-3 py-2.5">
                  <button
                    class="p-0.5 rounded hover:bg-surface-3 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors"
                    :title="expandedTables.has(table.name) ? 'Collapse' : 'Expand'"
                    @click="(e: Event) => toggleExpanded(table.name, e)"
                  >
                    <ChevronRight
                      :size="11"
                      class="transition-transform"
                      :class="{ 'rotate-90': expandedTables.has(table.name) }"
                    />
                  </button>
                </td>
                <td class="px-2 py-2.5">
                  <div class="flex items-center gap-2">
                    <Table2 :size="12" class="text-muted-foreground/30 shrink-0" />
                    <span
                      class="font-mono text-foreground/80 group-hover:text-foreground transition-colors"
                    >
                      {{ table.name }}
                    </span>
                  </div>
                </td>
                <td class="px-2 py-2.5">
                  <div class="flex flex-col items-end gap-1">
                    <span
                      class="font-mono text-xs"
                      :class="
                        table.rowCount > 0 ? 'text-foreground/80' : 'text-muted-foreground/35'
                      "
                    >
                      {{ fmtNum(table.rowCount) }}
                    </span>
                    <div
                      v-if="table.rowCount > 0"
                      class="w-20 h-[2px] bg-surface-3 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full bg-info/55 rounded-full"
                        :style="{ width: barPct(table.rowCount) }"
                      />
                    </div>
                  </div>
                </td>
                <td class="px-2 py-2.5 text-center">
                  <span class="text-[10px] font-mono text-muted-foreground/40 capitalize">
                    {{ table.tableType }}
                  </span>
                </td>
              </tr>

              <!-- Expanded schema detail -->
              <template v-if="expandedTables.has(table.name) && table.sql">
                <tr class="bg-surface-0/80 border-b border-border/10">
                  <td colspan="4" class="px-10 py-3">
                    <div class="flex items-start gap-2">
                      <span
                        class="text-[9px] uppercase tracking-widest text-muted-foreground/35 font-medium shrink-0 mt-1"
                      >
                        SQL
                      </span>
                      <pre
                        class="text-[11px] font-mono text-foreground/60 whitespace-pre-wrap break-all flex-1"
                        >{{ table.sql }}</pre
                      >
                    </div>
                  </td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </template>
    </div>
  </div>
</template>
