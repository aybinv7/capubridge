<script setup lang="ts">
import { ref, computed, shallowRef, watch } from "vue";
import {
  Database,
  Table,
  Eye,
  X,
  RefreshCw,
  Play,
  ChevronLeft,
  ChevronRight,
  Code,
  KeyRound,
  AlertCircle,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useSqliteWasm, type SqlExecResult, type SqlObject } from "./useSqliteWasm";

const props = defineProps<{
  label: string;
  loadBytes: () => Promise<Uint8Array>;
}>();

const emit = defineEmits<{ close: [] }>();

const inspector = useSqliteWasm();
const initialising = ref(false);
const initError = ref<string | null>(null);
const objects = shallowRef<SqlObject[]>([]);
const selected = ref<string | null>(null);
const tab = ref<"browse" | "structure" | "sql">("browse");
const page = ref(0);
const pageSize = ref(100);
const rows = shallowRef<SqlExecResult>({ columns: [], rows: [] });
const sqlInput = ref("SELECT name, type FROM sqlite_master ORDER BY type, name;");
const sqlResults = shallowRef<SqlExecResult[]>([]);
const sqlError = ref<string | null>(null);
const objectFilter = ref("");

const filteredObjects = computed(() => {
  if (!objectFilter.value) return objects.value;
  const q = objectFilter.value.toLowerCase();
  return objects.value.filter(
    (o) => o.name.toLowerCase().includes(q) || o.type.toLowerCase().includes(q),
  );
});

const sqliteVersion = ref("");

async function load() {
  initialising.value = true;
  initError.value = null;
  try {
    const bytes = await props.loadBytes();
    await inspector.open(bytes);
    objects.value = inspector.listObjects();
    sqliteVersion.value = inspector.getSqliteVersion();
    if (objects.value.length > 0) selected.value = objects.value[0].name;
    else selected.value = null;
    refreshRows();
  } catch (e) {
    initError.value = e instanceof Error ? e.message : String(e);
  } finally {
    initialising.value = false;
  }
}

function refreshRows() {
  if (!selected.value) {
    rows.value = { columns: [], rows: [] };
    return;
  }
  try {
    rows.value = inspector.getRows(selected.value, page.value * pageSize.value, pageSize.value);
  } catch (e) {
    rows.value = { columns: [], rows: [] };
    sqlError.value = e instanceof Error ? e.message : String(e);
  }
}

watch(selected, () => {
  page.value = 0;
  tab.value = "browse";
  refreshRows();
});

watch([page, pageSize], () => refreshRows());

const selectedObject = computed(() => objects.value.find((o) => o.name === selected.value));
const columns = computed(() => (selected.value ? inspector.listColumns(selected.value) : []));
const indexes = computed(() => (selected.value ? inspector.listIndexes(selected.value) : []));
const foreignKeys = computed(() =>
  selected.value ? inspector.listForeignKeys(selected.value) : [],
);

const totalRows = computed(() => selectedObject.value?.rowCount ?? 0);
const totalPages = computed(() => Math.max(1, Math.ceil(totalRows.value / pageSize.value)));
const canPrev = computed(() => page.value > 0);
const canNext = computed(() => page.value < totalPages.value - 1);

function runSql() {
  sqlError.value = null;
  try {
    sqlResults.value = inspector.exec(sqlInput.value);
  } catch (e) {
    sqlResults.value = [];
    sqlError.value = e instanceof Error ? e.message : String(e);
  }
}

function renderCell(value: unknown): { text: string; tone: "null" | "blob" | "value" } {
  if (value === null || value === undefined) return { text: "NULL", tone: "null" };
  if (value instanceof Uint8Array) return { text: `<blob ${value.byteLength} B>`, tone: "blob" };
  if (typeof value === "object") return { text: JSON.stringify(value), tone: "value" };
  return { text: String(value), tone: "value" };
}

function close() {
  inspector.close();
  emit("close");
}

load();
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div
      class="flex shrink-0 items-center gap-2 border-b border-border/20 bg-surface-1/40 px-3 py-1.5"
    >
      <Database :size="14" class="text-info shrink-0" />
      <span class="truncate font-mono text-[12px] text-foreground">{{ props.label }}</span>
      <Badge
        v-if="sqliteVersion"
        variant="outline"
        class="ml-1 h-4 border-border/30 bg-surface-3 px-1.5 text-[9px] font-mono uppercase text-muted-foreground/50"
      >
        sqlite {{ sqliteVersion }}
      </Badge>
      <Badge
        v-if="inspector.dbSize.value"
        variant="outline"
        class="h-4 border-border/30 bg-surface-3 px-1.5 text-[9px] font-mono text-muted-foreground/50"
      >
        {{ (inspector.dbSize.value / 1024 / 1024).toFixed(2) }} MB
      </Badge>
      <Button
        variant="ghost"
        size="sm"
        class="ml-auto h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground"
        @click="load"
      >
        <RefreshCw :size="12" /> Reload
      </Button>
      <Button
        variant="ghost"
        size="sm"
        class="h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground"
        @click="close"
      >
        <X :size="12" /> Close
      </Button>
    </div>

    <div
      v-if="initialising"
      class="flex flex-1 items-center justify-center gap-2 text-[11px] text-muted-foreground/50"
    >
      <RefreshCw :size="14" class="animate-spin" />
      Loading database…
    </div>

    <div
      v-else-if="initError"
      class="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center"
    >
      <AlertCircle :size="20" class="text-error/70" />
      <p class="text-[12px] font-medium text-error">Failed to open database</p>
      <p class="max-w-md text-[11px] text-muted-foreground/60">{{ initError }}</p>
    </div>

    <ResizablePanelGroup v-else direction="horizontal" class="flex-1">
      <ResizablePanel :default-size="22" :min-size="15" :max-size="40">
        <div class="flex h-full flex-col">
          <div
            class="m-2 flex items-center gap-2 rounded-md border border-border/30 bg-surface-3 px-2 py-1.5"
          >
            <Table :size="11" class="text-muted-foreground/50" />
            <Input
              v-model="objectFilter"
              class="h-5 border-0 bg-transparent p-0 text-xs font-mono focus-visible:ring-0 placeholder:text-muted-foreground/40"
              placeholder="Filter tables…"
            />
          </div>
          <ScrollArea class="flex-1">
            <div
              v-if="!filteredObjects.length"
              class="px-3 py-6 text-center text-[11px] text-muted-foreground/40"
            >
              No tables
            </div>
            <button
              v-for="obj in filteredObjects"
              :key="obj.name"
              class="mr-1 flex w-full items-center gap-2 rounded-r-lg px-3 py-2 text-xs transition-colors"
              :class="
                selected === obj.name
                  ? 'bg-surface-3 font-medium text-foreground'
                  : 'text-muted-foreground/60 hover:bg-surface-3/50 hover:text-muted-foreground'
              "
              @click="selected = obj.name"
            >
              <component
                :is="obj.type === 'view' ? Eye : Table"
                class="h-3.5 w-3.5 shrink-0 opacity-50"
              />
              <span class="truncate text-left font-mono">{{ obj.name }}</span>
              <span class="ml-auto text-[10px] font-mono text-muted-foreground/30">
                {{ obj.rowCount.toLocaleString() }}
              </span>
            </button>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle with-handle />

      <ResizablePanel :default-size="78">
        <div class="flex h-full flex-col overflow-hidden">
          <div
            class="flex shrink-0 items-center gap-0.5 border-b border-border/20 bg-surface-1/40 px-2"
          >
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-3 text-[11px]"
              :class="
                tab === 'browse' ? 'text-foreground bg-surface-3' : 'text-muted-foreground/60'
              "
              :disabled="!selected"
              @click="tab = 'browse'"
            >
              <Table :size="11" /> Browse
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-3 text-[11px]"
              :class="
                tab === 'structure' ? 'text-foreground bg-surface-3' : 'text-muted-foreground/60'
              "
              :disabled="!selected"
              @click="tab = 'structure'"
            >
              <KeyRound :size="11" /> Structure
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 px-3 text-[11px]"
              :class="tab === 'sql' ? 'text-foreground bg-surface-3' : 'text-muted-foreground/60'"
              @click="tab = 'sql'"
            >
              <Code :size="11" /> SQL
            </Button>
          </div>

          <template v-if="tab === 'browse'">
            <div
              class="flex shrink-0 items-center gap-2 border-b border-border/20 px-3 py-1.5 text-[11px] text-muted-foreground/60"
            >
              <Button
                variant="ghost"
                size="sm"
                class="h-6 w-6 p-0"
                :disabled="!canPrev"
                @click="page--"
              >
                <ChevronLeft :size="12" />
              </Button>
              <span class="font-mono">
                Page {{ page + 1 }} / {{ totalPages }} · {{ totalRows.toLocaleString() }} rows
              </span>
              <Button
                variant="ghost"
                size="sm"
                class="h-6 w-6 p-0"
                :disabled="!canNext"
                @click="page++"
              >
                <ChevronRight :size="12" />
              </Button>
              <span class="ml-auto font-mono text-muted-foreground/40">
                {{ rows.rows.length }} loaded
              </span>
            </div>

            <div class="flex-1 overflow-auto">
              <table v-if="rows.columns.length" class="w-full text-xs">
                <thead class="sticky top-0 z-10">
                  <tr
                    class="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground/50 border-b border-border/30"
                  >
                    <th
                      v-for="col in rows.columns"
                      :key="col"
                      class="px-3 py-2 font-medium whitespace-nowrap"
                    >
                      {{ col }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, idx) in rows.rows"
                    :key="idx"
                    class="border-b border-border/20 data-row"
                  >
                    <td v-for="(cell, ci) in row" :key="ci" class="px-3 py-1.5 font-mono align-top">
                      <span
                        class="block max-w-md truncate"
                        :class="{
                          'italic text-muted-foreground/40': renderCell(cell).tone === 'null',
                          'text-violet-300': renderCell(cell).tone === 'blob',
                          'text-secondary-foreground': renderCell(cell).tone === 'value',
                        }"
                      >
                        {{ renderCell(cell).text }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div
                v-else
                class="flex h-full items-center justify-center text-[11px] text-muted-foreground/40"
              >
                Select a table to browse rows.
              </div>
            </div>
          </template>

          <template v-else-if="tab === 'structure'">
            <ScrollArea class="flex-1">
              <div class="space-y-6 px-4 py-4 text-xs">
                <section>
                  <div class="mb-2 flex items-center gap-2">
                    <Table :size="12" class="text-muted-foreground/40" />
                    <span
                      class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                    >
                      Columns
                    </span>
                  </div>
                  <table class="w-full font-mono">
                    <thead>
                      <tr class="text-left text-muted-foreground/40">
                        <th class="py-1.5 font-medium">#</th>
                        <th class="py-1.5 font-medium">Name</th>
                        <th class="py-1.5 font-medium">Type</th>
                        <th class="py-1.5 font-medium">Null</th>
                        <th class="py-1.5 font-medium">Default</th>
                        <th class="py-1.5 font-medium">PK</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="col in columns"
                        :key="col.cid"
                        class="border-t border-border/20 text-secondary-foreground"
                      >
                        <td class="py-1.5 text-muted-foreground/50">{{ col.cid }}</td>
                        <td class="py-1.5">{{ col.name }}</td>
                        <td class="py-1.5 text-muted-foreground/70">{{ col.type || "—" }}</td>
                        <td class="py-1.5 text-muted-foreground/70">
                          {{ col.notnull ? "NOT NULL" : "—" }}
                        </td>
                        <td class="py-1.5 text-muted-foreground/70">
                          {{ col.defaultValue ?? "—" }}
                        </td>
                        <td class="py-1.5 text-muted-foreground/70">
                          {{ col.pk > 0 ? `PK${col.pk}` : "—" }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section v-if="indexes.length">
                  <div
                    class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                  >
                    Indexes
                  </div>
                  <table class="w-full font-mono">
                    <thead>
                      <tr class="text-left text-muted-foreground/40">
                        <th class="py-1.5 font-medium">Name</th>
                        <th class="py-1.5 font-medium">Unique</th>
                        <th class="py-1.5 font-medium">Origin</th>
                        <th class="py-1.5 font-medium">Partial</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="idx in indexes"
                        :key="idx.name"
                        class="border-t border-border/20 text-secondary-foreground"
                      >
                        <td class="py-1.5">{{ idx.name }}</td>
                        <td class="py-1.5 text-muted-foreground/70">
                          {{ idx.unique ? "yes" : "no" }}
                        </td>
                        <td class="py-1.5 text-muted-foreground/70">{{ idx.origin }}</td>
                        <td class="py-1.5 text-muted-foreground/70">
                          {{ idx.partial ? "yes" : "no" }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section v-if="foreignKeys.length">
                  <div
                    class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                  >
                    Foreign keys
                  </div>
                  <table class="w-full font-mono">
                    <thead>
                      <tr class="text-left text-muted-foreground/40">
                        <th class="py-1.5 font-medium">From</th>
                        <th class="py-1.5 font-medium">→</th>
                        <th class="py-1.5 font-medium">To</th>
                        <th class="py-1.5 font-medium">On update</th>
                        <th class="py-1.5 font-medium">On delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="fk in foreignKeys"
                        :key="`${fk.id}-${fk.seq}`"
                        class="border-t border-border/20 text-secondary-foreground"
                      >
                        <td class="py-1.5">{{ fk.from }}</td>
                        <td class="py-1.5 text-muted-foreground/40">→</td>
                        <td class="py-1.5">{{ fk.table }}.{{ fk.to }}</td>
                        <td class="py-1.5 text-muted-foreground/70">{{ fk.onUpdate || "—" }}</td>
                        <td class="py-1.5 text-muted-foreground/70">{{ fk.onDelete || "—" }}</td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <section v-if="selectedObject?.sql">
                  <div
                    class="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/40"
                  >
                    CREATE statement
                  </div>
                  <pre
                    class="overflow-x-auto rounded-md border border-border/30 bg-surface-3 p-3 font-mono text-[11px] text-secondary-foreground"
                    >{{ selectedObject.sql }}</pre
                  >
                </section>
              </div>
            </ScrollArea>
          </template>

          <template v-else-if="tab === 'sql'">
            <div class="flex shrink-0 flex-col gap-2 border-b border-border/20 px-3 py-2">
              <textarea
                v-model="sqlInput"
                rows="4"
                class="w-full resize-y rounded-md border border-border/30 bg-surface-3 px-3 py-2 font-mono text-xs text-secondary-foreground outline-none focus:border-border/60"
                placeholder="SELECT * FROM …"
                spellcheck="false"
              ></textarea>
              <div class="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 gap-1.5 border border-border/30 bg-surface-3 px-3 text-[11px] text-foreground hover:bg-surface-2"
                  @click="runSql"
                >
                  <Play :size="11" /> Run
                </Button>
                <span v-if="sqlError" class="text-[11px] text-error">{{ sqlError }}</span>
                <span v-else-if="sqlResults.length" class="text-[11px] text-muted-foreground/50">
                  {{ sqlResults.length }} result set(s),
                  {{ sqlResults.reduce((s, r) => s + r.rows.length, 0) }} row(s)
                </span>
              </div>
            </div>

            <ScrollArea class="flex-1">
              <div
                v-if="!sqlResults.length && !sqlError"
                class="px-3 py-6 text-center text-[11px] text-muted-foreground/40"
              >
                Run a query to see results here.
              </div>
              <div v-for="(rs, rsi) in sqlResults" :key="rsi" class="border-b border-border/30">
                <table class="w-full text-xs">
                  <thead class="sticky top-0 z-10">
                    <tr
                      class="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground/50 border-b border-border/30"
                    >
                      <th
                        v-for="col in rs.columns"
                        :key="col"
                        class="px-3 py-2 font-medium whitespace-nowrap"
                      >
                        {{ col }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(row, idx) in rs.rows"
                      :key="idx"
                      class="border-b border-border/20 data-row"
                    >
                      <td
                        v-for="(cell, ci) in row"
                        :key="ci"
                        class="px-3 py-1.5 font-mono align-top"
                      >
                        <span
                          class="block max-w-md truncate"
                          :class="{
                            'italic text-muted-foreground/40': renderCell(cell).tone === 'null',
                            'text-violet-300': renderCell(cell).tone === 'blob',
                            'text-secondary-foreground': renderCell(cell).tone === 'value',
                          }"
                        >
                          {{ renderCell(cell).text }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </template>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
