<script setup lang="ts">
import { computed, ref } from "vue";
import { Database, RefreshCw, AlertCircle, ChevronRight, ArrowRight } from "lucide-vue-next";
import type { StoreInfo } from "utils";

const props = defineProps<{
  dbName: string;
  dbVersion: number;
  dbOrigin: string;
  storeCount: number;
  stores: StoreInfo[];
  isLoading: boolean;
  isError?: boolean;
  totalIdbSize?: number;
}>();

const emit = defineEmits<{
  selectStore: [storeName: string];
  refresh: [];
}>();

const expandedStores = ref(new Set<string>());

function toggleExpanded(storeName: string, e: Event) {
  e.stopPropagation();
  const next = new Set(expandedStores.value);
  if (next.has(storeName)) {
    next.delete(storeName);
  } else {
    next.add(storeName);
  }
  expandedStores.value = next;
}

const totalRecords = computed(() => props.stores.reduce((sum, s) => sum + s.recordCount, 0));
const totalIndexes = computed(() => props.stores.reduce((sum, s) => sum + s.indexCount, 0));
const autoIncCount = computed(() => props.stores.filter((s) => s.autoIncrement).length);
const maxRecords = computed(() => Math.max(...props.stores.map((s) => s.recordCount), 1));

const dbEstimatedSize = computed(() =>
  props.stores.reduce((sum, s) => sum + (s.estimatedSize ?? 0), 0),
);

const sortedStores = computed(() =>
  [...props.stores].sort((a, b) => b.recordCount - a.recordCount),
);

const nonEmptyStores = computed(() => sortedStores.value.filter((s) => s.recordCount > 0));

const sortedBySize = computed(() =>
  [...props.stores]
    .filter((s) => s.estimatedSize > 0)
    .sort((a, b) => b.estimatedSize - a.estimatedSize),
);

const maxSize = computed(() => Math.max(...props.stores.map((s) => s.estimatedSize), 1));

function barPct(count: number): string {
  return `${Math.max(2, (count / maxRecords.value) * 100).toFixed(1)}%`;
}

function sizePct(bytes: number): string {
  return `${Math.max(2, (bytes / maxSize.value) * 100).toFixed(1)}%`;
}

function formatKey(keyPath: string | string[] | null | undefined): string {
  if (keyPath == null) return "—";
  if (Array.isArray(keyPath)) return keyPath.join(", ");
  return keyPath || "—";
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
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <!-- ── Top bar ─────────────────────────────────────── -->
    <div class="shrink-0 flex items-center gap-2.5 px-4 h-9 border-b border-border/20 bg-surface-1">
      <Database :size="13" class="text-muted-foreground/50 shrink-0" />
      <span class="font-mono text-xs text-foreground/90 truncate min-w-0 font-medium">{{
        dbName
      }}</span>
      <span
        class="shrink-0 font-mono text-[10px] text-muted-foreground/50 bg-surface-3 px-1.5 py-0.5 rounded"
      >
        {{ dbOrigin }}
      </span>
      <span
        class="shrink-0 font-mono text-[10px] text-info/70 border border-info/25 px-1.5 py-0.5 rounded"
      >
        v{{ dbVersion }}
      </span>
      <button
        class="ml-auto shrink-0 p-1 rounded hover:bg-surface-3 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
        title="Refresh"
        @click="emit('refresh')"
      >
        <RefreshCw :size="11" />
      </button>
    </div>

    <!-- ── Stats strip ─────────────────────────────────── -->
    <div
      class="shrink-0 flex items-stretch border-b border-border/20 bg-surface-0 divide-x divide-border/20"
    >
      <div class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span class="font-mono text-base font-semibold text-foreground/90">{{
          fmtNum(storeCount)
        }}</span>
        <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50">Stores</span>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span class="font-mono text-base font-semibold text-foreground/90">{{
          fmtNum(totalRecords)
        }}</span>
        <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50">Records</span>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span class="font-mono text-base font-semibold text-foreground/90">{{
          fmtNum(totalIndexes)
        }}</span>
        <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50">Indexes</span>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <span class="font-mono text-base font-semibold text-foreground/90">{{
          fmtNum(autoIncCount)
        }}</span>
        <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50">Auto-Inc</span>
      </div>
      <div class="flex-1 flex flex-col items-center justify-center py-3 gap-0.5">
        <div class="flex items-center gap-1.5">
          <span
            class="font-mono text-base font-semibold"
            :class="
              dbEstimatedSize != null && dbEstimatedSize > 0
                ? 'text-foreground/90'
                : 'text-muted-foreground/30'
            "
          >
            {{ formatBytes(dbEstimatedSize) }}
          </span>
          <span v-if="totalIdbSize != null" class="text-muted-foreground/30 text-[10px]">/</span>
          <span
            v-if="totalIdbSize != null"
            class="font-mono text-[13px]"
            :class="totalIdbSize > 0 ? 'text-muted-foreground/50' : 'text-muted-foreground/20'"
          >
            {{ formatBytes(totalIdbSize) }}
          </span>
        </div>
        <span class="text-[9px] uppercase tracking-widest text-muted-foreground/50"
          >DB / Total</span
        >
      </div>
    </div>

    <!-- ── Scrollable body ────────────────────────────── -->
    <div class="flex-1 overflow-auto min-h-0">
      <!-- Loading -->
      <div v-if="isLoading" class="flex items-center justify-center h-32">
        <RefreshCw :size="14" class="animate-spin text-muted-foreground/30" />
      </div>

      <!-- Error -->
      <div v-else-if="isError" class="flex flex-col items-center justify-center h-32 gap-2">
        <AlertCircle :size="16" class="text-muted-foreground/25" />
        <p class="text-xs text-muted-foreground/50">Failed to load store information</p>
        <button
          class="text-xs text-info/70 hover:text-info transition-colors"
          @click="emit('refresh')"
        >
          Retry
        </button>
      </div>

      <!-- Empty -->
      <div
        v-else-if="stores.length === 0"
        class="flex flex-col items-center justify-center h-32 gap-2"
      >
        <Database :size="16" class="text-muted-foreground/20" />
        <p class="text-xs text-muted-foreground/40">No store details available</p>
      </div>

      <template v-else>
        <!-- ── Distribution charts ──────────────────────── -->
        <div
          v-if="nonEmptyStores.length > 0 || sortedBySize.length > 0"
          class="border-b border-border/20 grid grid-cols-2 divide-x divide-border/20"
        >
          <!-- By records -->
          <div class="px-4 py-3">
            <p
              class="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-2.5 font-medium"
            >
              By records
            </p>
            <div class="flex flex-col gap-1.5">
              <div
                v-for="store in nonEmptyStores.slice(0, 10)"
                :key="store.name"
                class="flex items-center gap-2 group cursor-pointer"
                @click="emit('selectStore', store.name)"
              >
                <span
                  class="w-36 truncate text-right font-mono text-[11px] text-muted-foreground/60 group-hover:text-foreground/70 transition-colors shrink-0"
                  :title="store.name"
                  >{{ store.name }}</span
                >
                <div class="flex-1 h-[3px] bg-surface-3 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-info/50 group-hover:bg-info/70 rounded-full transition-all duration-300"
                    :style="{ width: barPct(store.recordCount) }"
                  />
                </div>
                <span
                  class="w-12 text-right font-mono text-[11px] text-muted-foreground/55 shrink-0"
                >
                  {{ fmtNum(store.recordCount) }}
                </span>
              </div>
              <p
                v-if="nonEmptyStores.length > 10"
                class="text-[9px] text-muted-foreground/30 text-right font-mono mt-0.5"
              >
                +{{ nonEmptyStores.length - 10 }} more
              </p>
            </div>
          </div>

          <!-- By size -->
          <div class="px-4 py-3">
            <p
              class="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-2.5 font-medium"
            >
              By size
              <span class="normal-case tracking-normal text-muted-foreground/25">(estimated)</span>
            </p>
            <div v-if="sortedBySize.length > 0" class="flex flex-col gap-1.5">
              <div
                v-for="store in sortedBySize.slice(0, 10)"
                :key="store.name"
                class="flex items-center gap-2 group cursor-pointer"
                @click="emit('selectStore', store.name)"
              >
                <span
                  class="w-36 truncate text-right font-mono text-[11px] text-muted-foreground/60 group-hover:text-foreground/70 transition-colors shrink-0"
                  :title="store.name"
                  >{{ store.name }}</span
                >
                <div class="flex-1 h-[3px] bg-surface-3 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-warning/45 group-hover:bg-warning/65 rounded-full transition-all duration-300"
                    :style="{ width: sizePct(store.estimatedSize) }"
                  />
                </div>
                <span
                  class="w-14 text-right font-mono text-[11px] text-muted-foreground/55 shrink-0"
                >
                  {{ formatBytes(store.estimatedSize) }}
                </span>
              </div>
              <p
                v-if="sortedBySize.length > 10"
                class="text-[9px] text-muted-foreground/30 text-right font-mono mt-0.5"
              >
                +{{ sortedBySize.length - 10 }} more
              </p>
            </div>
            <div v-else class="flex items-center h-8">
              <span class="text-[10px] text-muted-foreground/25 font-mono">No size data yet</span>
            </div>
          </div>
        </div>

        <!-- ── Main table ──────────────────────────────── -->
        <table class="w-full text-xs border-collapse">
          <thead class="sticky top-0 z-10 bg-surface-1 border-b border-border/20">
            <tr class="text-left">
              <th class="px-3 py-2.5 w-6"></th>
              <th
                class="px-2 py-2.5 font-medium text-[9px] uppercase tracking-widest text-muted-foreground/50"
              >
                Store
              </th>
              <th
                class="px-2 py-2.5 font-medium text-[9px] uppercase tracking-widest text-muted-foreground/50"
              >
                Key Path
              </th>
              <th
                class="px-2 py-2.5 font-medium text-[9px] uppercase tracking-widest text-muted-foreground/50 text-right w-36"
              >
                Records
              </th>
              <th
                class="px-2 py-2.5 font-medium text-[9px] uppercase tracking-widest text-muted-foreground/50 w-24"
              >
                Next Key
              </th>
              <th
                class="px-2 py-2.5 font-medium text-[9px] uppercase tracking-widest text-muted-foreground/50 text-center w-12"
              >
                Idx
              </th>
              <th
                class="px-3 py-2.5 font-medium text-[9px] uppercase tracking-widest text-muted-foreground/50 text-center w-10"
              >
                AI
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="store in sortedStores" :key="store.name">
              <!-- Store row -->
              <tr
                class="group cursor-pointer border-b border-border/10 hover:bg-surface-2/70 transition-colors"
                @click="emit('selectStore', store.name)"
              >
                <!-- Expand chevron -->
                <td class="px-3 py-2.5">
                  <ChevronRight
                    :size="11"
                    class="text-muted-foreground/25 group-hover:text-muted-foreground/60 transition-colors"
                  />
                </td>

                <!-- Store name -->
                <td class="px-2 py-2.5">
                  <span
                    class="font-mono text-foreground/80 group-hover:text-foreground transition-colors"
                  >
                    {{ store.name }}
                  </span>
                </td>

                <!-- Key path -->
                <td class="px-2 py-2.5">
                  <span
                    class="font-mono text-[11px] text-muted-foreground/55 bg-surface-3 px-1.5 py-0.5 rounded"
                  >
                    {{ formatKey(store.keyPath) }}
                  </span>
                </td>

                <!-- Records + bar -->
                <td class="px-2 py-2.5">
                  <div class="flex flex-col items-end gap-1">
                    <span
                      class="font-mono text-xs"
                      :class="
                        store.recordCount > 0 ? 'text-foreground/80' : 'text-muted-foreground/35'
                      "
                    >
                      {{ fmtNum(store.recordCount) }}
                    </span>
                    <div
                      v-if="store.recordCount > 0"
                      class="w-28 h-[2px] bg-surface-3 rounded-full overflow-hidden"
                    >
                      <div
                        class="h-full bg-info/55 rounded-full"
                        :style="{ width: barPct(store.recordCount) }"
                      />
                    </div>
                  </div>
                </td>

                <!-- Next key -->
                <td class="px-2 py-2.5">
                  <span
                    v-if="store.autoIncrement && store.keyGeneratorValue != null"
                    class="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground/60"
                  >
                    <ArrowRight :size="9" class="text-muted-foreground/35" />
                    {{ fmtNum(store.keyGeneratorValue) }}
                  </span>
                  <span v-else class="text-muted-foreground/20 font-mono text-[11px]">—</span>
                </td>

                <!-- Index count (click to expand) -->
                <td class="px-2 py-2.5 text-center">
                  <button
                    v-if="store.indexCount > 0"
                    class="inline-flex items-center gap-0.5 font-mono text-[11px] px-1.5 py-0.5 rounded transition-colors"
                    :class="
                      expandedStores.has(store.name)
                        ? 'bg-info/15 text-info/80'
                        : 'bg-surface-3 text-muted-foreground/60 hover:bg-surface-3 hover:text-muted-foreground/80'
                    "
                    :title="expandedStores.has(store.name) ? 'Collapse indexes' : 'Expand indexes'"
                    @click="(e) => toggleExpanded(store.name, e)"
                  >
                    <ChevronRight
                      :size="9"
                      class="transition-transform"
                      :class="{ 'rotate-90': expandedStores.has(store.name) }"
                    />
                    {{ store.indexCount }}
                  </button>
                  <span v-else class="text-muted-foreground/20 font-mono text-[11px]">—</span>
                </td>

                <!-- Auto-increment dot -->
                <td class="px-3 py-2.5 text-center">
                  <span
                    v-if="store.autoIncrement"
                    class="inline-block w-1.5 h-1.5 rounded-full bg-success/60"
                    title="Auto-increment"
                  />
                  <span v-else class="text-muted-foreground/15 font-mono text-[11px]">—</span>
                </td>
              </tr>

              <!-- Index sub-rows (expanded) -->
              <template v-if="expandedStores.has(store.name) && store.indexes.length > 0">
                <!-- Sub-header -->
                <tr class="bg-surface-0/80 border-b border-border/10">
                  <td colspan="2" class="pl-10 pr-2 py-1.5">
                    <span
                      class="text-[9px] uppercase tracking-widest text-muted-foreground/35 font-medium"
                      >Index</span
                    >
                  </td>
                  <td class="px-2 py-1.5">
                    <span
                      class="text-[9px] uppercase tracking-widest text-muted-foreground/35 font-medium"
                      >Key Path</span
                    >
                  </td>
                  <td class="px-2 py-1.5 text-right">
                    <span
                      class="text-[9px] uppercase tracking-widest text-muted-foreground/35 font-medium"
                      >Unique</span
                    >
                  </td>
                  <td class="px-2 py-1.5 text-center">
                    <span
                      class="text-[9px] uppercase tracking-widest text-muted-foreground/35 font-medium"
                      >Multi</span
                    >
                  </td>
                  <td colspan="2" class="px-2 py-1.5"></td>
                </tr>
                <tr
                  v-for="(idx, i) in store.indexes"
                  :key="idx.name"
                  class="bg-surface-0/80 border-b"
                  :class="i < store.indexes.length - 1 ? 'border-border/10' : 'border-border/20'"
                >
                  <!-- Indent + index name -->
                  <td colspan="2" class="pl-10 pr-2 py-1.5">
                    <span class="font-mono text-[11px] text-info/60">{{ idx.name }}</span>
                  </td>
                  <!-- Key path -->
                  <td class="px-2 py-1.5">
                    <span
                      class="font-mono text-[11px] text-muted-foreground/50 bg-surface-2 px-1.5 py-0.5 rounded"
                    >
                      {{ formatKey(idx.keyPath as string | string[] | null) }}
                    </span>
                  </td>
                  <!-- Unique -->
                  <td class="px-2 py-1.5 text-right">
                    <span
                      v-if="idx.unique"
                      class="inline-block w-1.5 h-1.5 rounded-full bg-success/55"
                    />
                    <span v-else class="text-muted-foreground/20 font-mono text-[10px]">—</span>
                  </td>
                  <!-- Multi-entry -->
                  <td class="px-2 py-1.5 text-center">
                    <span
                      v-if="idx.multiEntry"
                      class="inline-block w-1.5 h-1.5 rounded-full bg-warning/55"
                    />
                    <span v-else class="text-muted-foreground/20 font-mono text-[10px]">—</span>
                  </td>
                  <td colspan="2" class="px-2 py-1.5"></td>
                </tr>
              </template>
            </template>
          </tbody>
        </table>
      </template>
    </div>
  </div>
</template>
