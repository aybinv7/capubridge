<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Database, ChevronRight, ChevronDown, Search } from "lucide-vue-next";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { getMockIDBRecords, mockDatabases, type MockIDBRecord } from "@/data/mock-data";
import IDBTable from "./IDBTable.vue";
import IDBTableToolbar from "./IDBTableToolbar.vue";

const route = useRoute();
const router = useRouter();

const expandedDbs = ref<Set<string>>(new Set(["appDatabase"]));
const filter = ref("");

const dbName = computed(() => decodeURIComponent((route.params["db"] as string) ?? ""));
const storeName = computed(() => decodeURIComponent((route.params["store"] as string) ?? ""));
const page = ref(0);
const pageSize = ref(50);

const allRecords = computed<MockIDBRecord[]>(() => {
  if (!dbName.value || !storeName.value) return [];
  return getMockIDBRecords(dbName.value, storeName.value);
});

const filteredRecords = computed(() => {
  if (!filter.value) return allRecords.value;
  const q = filter.value.toLowerCase();
  return allRecords.value.filter(
    (r) =>
      String(r.key).toLowerCase().includes(q) || JSON.stringify(r.value).toLowerCase().includes(q),
  );
});

const pagedRecords = computed(() => {
  const start = page.value * pageSize.value;
  const end = start + pageSize.value;
  return filteredRecords.value.slice(start, end);
});

const hasMore = computed(() => (page.value + 1) * pageSize.value < filteredRecords.value.length);

const isLoading = ref(false);
const isError = ref(false);

function toggleDb(name: string) {
  if (expandedDbs.value.has(name)) expandedDbs.value.delete(name);
  else expandedDbs.value.add(name);
}

function navigateToStore(dbName: string, storeName: string) {
  void router.push(
    `/storage/indexeddb/${encodeURIComponent(dbName)}/${encodeURIComponent(storeName)}`,
  );
}

function isStoreActive(db: string, store: string) {
  return dbName.value === db && storeName.value === store;
}

function prevPage() {
  if (page.value > 0) page.value--;
}
function nextPage() {
  if (hasMore.value) page.value++;
}
function handlePageSizeChange(size: number) {
  pageSize.value = size;
  page.value = 0;
}

function refetch() {
  isLoading.value = true;
  setTimeout(() => {
    isLoading.value = false;
  }, 300);
}

const tableRecords = computed(() =>
  pagedRecords.value.map((r) => ({ key: r.key, value: r.value })),
);
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <ResizablePanel :default-size="15" :min-size="10" :max-size="30">
        <div class="flex h-full flex-col border-r border-border/30">
          <div
            class="flex items-center gap-2 bg-surface-3 rounded-md px-2.5 py-1.5 border border-border/30 focus-within:border-border/60 transition-colors"
          >
            <Search class="w-3.5 h-3.5 text-muted-foreground/50" />
            <Input
              v-model="filter"
              class="h-6 text-xs font-mono bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/40"
              placeholder="Filter by key or value…"
            />
          </div>
          <ScrollArea class="flex-1">
            <ul class="py-1">
              <li v-for="db in mockDatabases" :key="db.name">
                <button
                  class="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground/60 transition-colors hover:bg-surface-3/50 hover:text-muted-foreground"
                  @click="toggleDb(db.name)"
                >
                  <component
                    :is="expandedDbs.has(db.name) ? ChevronDown : ChevronRight"
                    :size="12"
                    class="shrink-0 opacity-50"
                  />
                  <Database :size="13" class="shrink-0 opacity-40" />
                  <span class="flex-1 truncate text-left">{{ db.name }}</span>
                  <span class="text-[10px] font-mono text-muted-foreground/30 shrink-0"
                    >v{{ db.version }}</span
                  >
                </button>
                <ul v-if="expandedDbs.has(db.name)">
                  <li v-for="store in db.stores" :key="store.name">
                    <button
                      class="flex w-full items-center gap-1.5 py-1.5 pl-[26px] pr-3 text-xs transition-colors"
                      :class="
                        isStoreActive(db.name, store.name)
                          ? 'text-foreground font-medium bg-surface-3 border-l-2 border-foreground pl-[24px]'
                          : 'text-[#676767] hover:bg-surface-3/50 hover:text-[#888888]'
                      "
                      @click="navigateToStore(db.name, store.name)"
                    >
                      <span class="truncate text-left">{{ store.name }}</span>
                      <span
                        class="ml-auto text-[10px] font-mono shrink-0"
                        :class="
                          isStoreActive(db.name, store.name)
                            ? 'text-muted-foreground/50'
                            : 'text-[#444444]'
                        "
                        >{{ store.recordCount }}</span
                      >
                    </button>
                  </li>
                </ul>
              </li>
            </ul>
          </ScrollArea>
        </div>
      </ResizablePanel>
      <ResizableHandle with-handle />
      <ResizablePanel :default-size="80">
        <div
          v-if="!dbName || !storeName"
          class="flex flex-1 items-center justify-center text-sm text-muted-foreground/30"
        >
          Select a store from the sidebar
        </div>

        <template v-else>
          <div class="flex flex-col h-full">
            <IDBTableToolbar
              :store-name="storeName"
              :db-name="dbName"
              :is-loading="isLoading"
              :page="page"
              :page-size="pageSize"
              :has-more="hasMore"
              :record-count="pagedRecords.length"
              @refresh="refetch"
              @prev="prevPage"
              @next="nextPage"
              @page-size-change="handlePageSizeChange"
            />

            <div
              v-if="isError"
              class="shrink-0 border-b border-border/30 bg-error/[0.06] px-4 py-2 text-xs text-error"
            >
              Failed to load records
            </div>

            <IDBTable :records="tableRecords" :is-loading="isLoading" />
          </div>
        </template>
      </ResizablePanel>
    </ResizablePanelGroup>
  </div>
</template>
