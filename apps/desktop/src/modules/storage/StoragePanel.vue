<script setup lang="ts">
import { ref, computed } from "vue";
import {
  Database,
  ChevronRight,
  ChevronDown,
  FileText,
  HardDrive,
  Folder,
  Search,
  Plus,
  Download,
  RefreshCw,
  ArrowUpDown,
  Copy,
  Pencil,
  Trash2,
} from "lucide-vue-next";
import PanelHeader from "@/components/layout/PanelHeader.vue";
import { storageTree, idbRecords, localStorageEntries } from "@/data/mock-data";

const expandedDBs = ref<string[]>(["appDatabase"]);
const selectedStore = ref("users");
const storageType = ref<"idb" | "ls">("idb");
const selectedRow = ref<string | null>(null);

function toggleDB(name: string) {
  if (expandedDBs.value.includes(name)) {
    expandedDBs.value = expandedDBs.value.filter((n) => n !== name);
  } else {
    expandedDBs.value = [...expandedDBs.value, name];
  }
}

const quotaPercent = computed(() => (storageTree.quota.used / storageTree.quota.total) * 100);

const currentStore = computed(() =>
  storageTree.indexedDB[0].stores.find((s) => s.name === selectedStore.value),
);

const idbColumns = Object.keys(idbRecords[0]);
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- Storage tree sidebar -->
    <div class="w-56 border-r border-border/30 bg-surface-1 flex flex-col shrink-0">
      <div class="h-10 flex items-center px-3 border-b border-border/20 gap-2">
        <Database class="w-3 h-3 text-primary" />
        <span class="text-xs font-medium text-foreground truncate">{{ storageTree.origin }}</span>
      </div>

      <div class="flex-1 overflow-y-auto py-1.5 px-1.5 text-2xs">
        <!-- IndexedDB -->
        <div class="mb-2">
          <div class="flex items-center gap-1.5 px-2 py-1">
            <span class="font-semibold text-muted-foreground uppercase tracking-[0.08em] text-2xs"
              >IndexedDB</span
            >
          </div>
          <div v-for="db in storageTree.indexedDB" :key="db.name">
            <button
              @click="toggleDB(db.name)"
              class="flex items-center gap-1 py-[5px] px-2 w-full text-left hover:bg-surface-2 rounded-md transition-colors group"
            >
              <component
                :is="expandedDBs.includes(db.name) ? ChevronDown : ChevronRight"
                class="w-3 h-3 text-dimmed"
              />
              <Folder class="w-3 h-3 text-warning/50" />
              <span class="text-secondary-foreground text-xs">{{ db.name }}</span>
              <span
                class="ml-auto text-2xs text-dimmed opacity-0 group-hover:opacity-100 transition-opacity"
                >v{{ db.version }}</span
              >
            </button>

            <div
              v-if="expandedDBs.includes(db.name)"
              class="ml-4 border-l border-border/20 pl-1.5 space-y-px py-0.5"
            >
              <button
                v-for="store in db.stores"
                :key="store.name"
                @click="
                  selectedStore = store.name;
                  storageType = 'idb';
                "
                class="flex items-center gap-1.5 py-[5px] px-2 w-full rounded-md text-left transition-all duration-100"
                :class="
                  selectedStore === store.name && storageType === 'idb'
                    ? 'bg-primary/[0.08] text-primary border border-primary/10'
                    : 'text-secondary-foreground hover:bg-surface-2 border border-transparent'
                "
              >
                <FileText class="w-3 h-3 shrink-0 opacity-50" />
                <span class="truncate text-xs">{{ store.name }}</span>
                <span class="ml-auto text-2xs text-dimmed font-mono">{{ store.recordCount }}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- LocalStorage -->
        <button
          @click="storageType = 'ls'"
          class="flex items-center gap-1.5 py-[5px] px-2 w-full rounded-md text-left transition-all mb-1"
          :class="
            storageType === 'ls'
              ? 'bg-primary/[0.08] text-primary border border-primary/10'
              : 'text-secondary-foreground hover:bg-surface-2 border border-transparent'
          "
        >
          <span class="font-semibold text-muted-foreground uppercase tracking-[0.08em] text-2xs"
            >LocalStorage</span
          >
          <span class="ml-auto text-2xs text-dimmed font-mono">{{
            storageTree.localStorage.keyCount
          }}</span>
        </button>

        <!-- Cache API -->
        <div class="mb-1 px-2 py-1">
          <span class="font-semibold text-muted-foreground uppercase tracking-[0.08em] text-2xs"
            >Cache API</span
          >
        </div>
        <div
          v-for="c in storageTree.cacheAPI"
          :key="c.name"
          class="flex items-center gap-1.5 py-[5px] px-2 ml-2 text-muted-foreground hover:text-secondary-foreground rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
        >
          <HardDrive class="w-3 h-3 opacity-40" />
          <span class="text-xs">{{ c.name }}</span>
          <span class="ml-auto text-2xs text-dimmed font-mono">{{ c.size }}</span>
        </div>
      </div>

      <!-- Quota bar -->
      <div class="p-3 border-t border-border/20">
        <div class="flex justify-between text-2xs text-muted-foreground mb-1.5">
          <span class="font-mono">{{ storageTree.quota.used }} MB</span>
          <span class="text-dimmed">{{ (storageTree.quota.total / 1000).toFixed(1) }} GB</span>
        </div>
        <div class="h-1 bg-surface-3 rounded-full overflow-hidden">
          <div
            class="h-full bg-gradient-to-r from-primary/80 to-primary rounded-full transition-all"
            :style="{ width: `${Math.max(quotaPercent, 2)}%` }"
          />
        </div>
        <div class="mt-1.5 flex items-center gap-1">
          <div class="w-1 h-1 rounded-full bg-success" />
          <span class="text-2xs text-success/80">Persistent</span>
        </div>
      </div>
    </div>

    <!-- Data view -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Toolbar -->
      <div
        class="h-10 border-b border-border/20 bg-surface-1 flex items-center px-3 gap-2 shrink-0"
      >
        <div class="flex items-center gap-1.5 text-2xs text-muted-foreground">
          <template v-if="storageType === 'idb'">
            <span class="text-dimmed">appDatabase</span>
            <ChevronRight class="w-3 h-3 text-dimmed" />
            <span class="text-foreground font-medium">{{ selectedStore }}</span>
            <template v-if="currentStore">
              <div class="w-px h-3 bg-border/40 mx-1" />
              <span class="font-mono">{{ currentStore.recordCount }} records</span>
            </template>
          </template>
          <span v-else class="text-foreground font-medium">LocalStorage</span>
        </div>
        <div class="flex-1" />
        <div class="flex items-center gap-0.5">
          <button
            v-for="action in [
              { icon: Search, title: 'Search' },
              { icon: Plus, title: 'Add' },
              { icon: Download, title: 'Export' },
              { icon: RefreshCw, title: 'Refresh' },
            ]"
            :key="action.title"
            :title="action.title"
            class="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
          >
            <component :is="action.icon" class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- IDB table -->
      <div v-if="storageType === 'idb'" class="flex-1 overflow-auto">
        <table class="w-full text-2xs">
          <thead class="sticky top-0 z-10">
            <tr
              class="bg-surface-2/80 backdrop-blur-sm text-left text-dimmed uppercase tracking-wider border-b border-border/20"
            >
              <th class="w-8 px-3 py-2">
                <input type="checkbox" class="rounded border-border/40 bg-surface-3" />
              </th>
              <th
                v-for="key in idbColumns"
                :key="key"
                class="px-3 py-2 font-medium cursor-pointer hover:text-muted-foreground transition-colors group"
              >
                <span class="flex items-center gap-1">
                  {{ key }}
                  <ArrowUpDown
                    class="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="record in idbRecords"
              :key="record.id"
              @click="selectedRow = selectedRow === record.id ? null : record.id"
              class="border-b border-border/10 cursor-pointer transition-colors"
              :class="selectedRow === record.id ? 'bg-primary/[0.04]' : 'data-row'"
            >
              <td class="px-3 py-0">
                <input type="checkbox" class="rounded border-border/40 bg-surface-3" />
              </td>
              <template v-for="[key, val] in Object.entries(record)" :key="key">
                <td class="px-3 py-2 whitespace-nowrap max-w-[180px] truncate font-mono text-xs">
                  <span v-if="val === null" class="text-dimmed italic">null</span>
                  <span
                    v-else-if="typeof val === 'object'"
                    class="text-primary/60 cursor-pointer hover:text-primary transition-colors"
                    >{{ JSON.stringify(val) }}</span
                  >
                  <span v-else-if="key === 'id'" class="text-info/70">{{ String(val) }}</span>
                  <span v-else-if="key === 'email'" class="text-secondary-foreground">{{
                    String(val)
                  }}</span>
                  <span
                    v-else-if="key === 'role'"
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-2xs font-medium"
                    :class="
                      val === 'admin'
                        ? 'bg-warning/10 text-warning'
                        : val === 'moderator'
                          ? 'bg-info/10 text-info'
                          : 'bg-surface-3 text-muted-foreground'
                    "
                    >{{ String(val) }}</span
                  >
                  <span v-else class="text-secondary-foreground">{{ String(val) }}</span>
                </td>
              </template>
            </tr>
          </tbody>
        </table>

        <!-- Pagination -->
        <div
          class="h-8 border-t border-border/20 bg-surface-1 flex items-center px-3 gap-3 text-2xs text-muted-foreground sticky bottom-0"
        >
          <span
            >1–{{ idbRecords.length }} of {{ currentStore?.recordCount || idbRecords.length }}</span
          >
          <div class="flex-1" />
          <span class="text-dimmed">50 / page</span>
          <div class="flex gap-1">
            <button
              class="px-2 py-0.5 rounded bg-surface-3 text-dimmed hover:text-muted-foreground transition-colors"
            >
              ←
            </button>
            <button
              class="px-2 py-0.5 rounded bg-surface-3 text-dimmed hover:text-muted-foreground transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <!-- LocalStorage table -->
      <div v-else class="flex-1 overflow-auto">
        <table class="w-full text-2xs">
          <thead class="sticky top-0 z-10">
            <tr
              class="bg-surface-2/80 backdrop-blur-sm text-left text-dimmed uppercase tracking-wider border-b border-border/20"
            >
              <th class="px-3 py-2 font-medium">Key</th>
              <th class="px-3 py-2 font-medium">Value</th>
              <th class="px-3 py-2 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in localStorageEntries"
              :key="entry.key"
              class="border-b border-border/10 data-row group"
            >
              <td class="px-3 py-2 font-mono text-xs text-info/70 whitespace-nowrap">
                {{ entry.key }}
              </td>
              <td class="px-3 py-2 font-mono text-xs text-secondary-foreground max-w-md truncate">
                {{ entry.value }}
              </td>
              <td class="px-3 py-2">
                <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    class="p-1 rounded text-dimmed hover:text-muted-foreground hover:bg-surface-3 transition-colors"
                  >
                    <Copy class="w-3 h-3" />
                  </button>
                  <button
                    class="p-1 rounded text-dimmed hover:text-muted-foreground hover:bg-surface-3 transition-colors"
                  >
                    <Pencil class="w-3 h-3" />
                  </button>
                  <button
                    class="p-1 rounded text-dimmed hover:text-error hover:bg-surface-3 transition-colors"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detail panel -->
    <Transition
      enter-active-class="transition-[width,opacity] duration-150 overflow-hidden"
      enter-from-class="w-0 opacity-0"
      enter-to-class="w-[280px] opacity-100"
      leave-active-class="transition-[width,opacity] duration-150 overflow-hidden"
      leave-from-class="w-[280px] opacity-100"
      leave-to-class="w-0 opacity-0"
    >
      <div
        v-if="selectedRow && storageType === 'idb'"
        class="w-[280px] border-l border-border/30 bg-surface-1 shrink-0 flex flex-col"
      >
        <div class="h-10 flex items-center justify-between px-3 border-b border-border/20 shrink-0">
          <span class="text-xs font-medium text-foreground">Record</span>
          <div class="flex items-center gap-0.5">
            <button
              class="p-1 rounded text-dimmed hover:text-foreground hover:bg-surface-3 transition-colors"
            >
              <Pencil class="w-3 h-3" />
            </button>
            <button
              class="p-1 rounded text-dimmed hover:text-error hover:bg-surface-3 transition-colors"
            >
              <Trash2 class="w-3 h-3" />
            </button>
            <button
              @click="selectedRow = null"
              class="p-1 rounded text-dimmed hover:text-foreground hover:bg-surface-3 transition-colors text-xs leading-none"
            >
              ✕
            </button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto p-3 space-y-3">
          <div
            v-for="[key, val] in Object.entries(idbRecords.find((r) => r.id === selectedRow) || {})"
            :key="key"
          >
            <div class="text-2xs text-muted-foreground mb-0.5 uppercase tracking-wider">
              {{ key }}
            </div>
            <div
              class="text-xs font-mono text-foreground break-all bg-surface-2/50 rounded-md px-2 py-1.5 border border-border/10"
            >
              <span v-if="val === null" class="text-dimmed italic">null</span>
              <span v-else-if="typeof val === 'object'">{{ JSON.stringify(val, null, 2) }}</span>
              <span v-else>{{ String(val) }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
