<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  Database,
  HardDrive,
  Archive,
  FolderOpen,
  ChevronRight,
  ChevronDown,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  mockDatabases,
  mockLocalStorageEntries,
  mockCacheAPIEntries,
  mockOPFSEntries,
} from "@/data/mock-data";

const route = useRoute();
const router = useRouter();

const expandedDbs = ref<Set<string>>(new Set(["appDatabase"]));
const expandedCaches = ref<Set<string>>(new Set(["v1-static"]));

const activeSection = computed(() => {
  const path = route.path;
  if (path.startsWith("/storage/idb")) return "idb";
  if (path.startsWith("/storage/localstorage")) return "localstorage";
  if (path.startsWith("/storage/cache")) return "cache";
  if (path.startsWith("/storage/opfs")) return "opfs";
  return "idb";
});

function toggleDb(dbName: string) {
  if (expandedDbs.value.has(dbName)) expandedDbs.value.delete(dbName);
  else expandedDbs.value.add(dbName);
}

function toggleCache(name: string) {
  if (expandedCaches.value.has(name)) expandedCaches.value.delete(name);
  else expandedCaches.value.add(name);
}

function navigateToStore(dbName: string, storeName: string) {
  void router.push(`/storage/idb/${encodeURIComponent(dbName)}/${encodeURIComponent(storeName)}`);
}

function isStoreActive(dbName: string, storeName: string) {
  return route.params["db"] === dbName && route.params["store"] === storeName;
}

function isSectionActive(section: string) {
  return activeSection.value === section;
}

const navItems = [
  { id: "idb" as const, icon: Database, label: "IndexedDB", to: "/storage/idb" },
  {
    id: "localstorage" as const,
    icon: HardDrive,
    label: "LocalStorage",
    to: "/storage/localstorage",
  },
  { id: "cache" as const, icon: Archive, label: "Cache API", to: "/storage/cache" },
  { id: "opfs" as const, icon: FolderOpen, label: "OPFS", to: "/storage/opfs" },
];
</script>

<template>
  <aside class="flex w-[220px] shrink-0 flex-col border-r border-border overflow-hidden">
    <!-- Top nav: storage type selector -->
    <div class="shrink-0 border-b border-border py-1">
      <RouterLink
        v-for="item in navItems"
        :key="item.id"
        :to="item.to"
        class="flex items-center gap-2 px-3 py-[5px] text-[12px] transition-colors"
        :class="
          isSectionActive(item.id)
            ? 'text-foreground bg-secondary border-l-2 border-foreground pl-[10px] font-medium'
            : 'text-muted-foreground/60 hover:bg-accent hover:text-accent-foreground border-l-2 border-transparent pl-[10px]'
        "
      >
        <component :is="item.icon" :size="12" class="shrink-0" />
        {{ item.label }}
      </RouterLink>
    </div>

    <!-- Contextual content -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden">
      <!-- ── IndexedDB tree ─────────────────────────────────────── -->
      <template v-if="activeSection === 'idb'">
        <div class="flex h-7 shrink-0 items-center border-b border-border px-3">
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40"
          >
            Databases
          </span>
        </div>
        <ul class="py-1">
          <li v-for="db in mockDatabases" :key="db.name">
            <Button
              variant="ghost"
              size="sm"
              class="w-full justify-start gap-1.5 px-3 py-[5px] h-auto text-[12px] text-muted-foreground"
              @click="toggleDb(db.name)"
            >
              <component
                :is="expandedDbs.has(db.name) ? ChevronDown : ChevronRight"
                :size="11"
                class="shrink-0 opacity-50"
              />
              <Database :size="12" class="shrink-0 opacity-50" />
              <span class="flex-1 truncate text-left">{{ db.name }}</span>
              <span class="text-[10px] font-mono text-muted-foreground/30 shrink-0"
                >v{{ db.version }}</span
              >
            </Button>
            <ul v-if="expandedDbs.has(db.name)">
              <li v-for="store in db.stores" :key="store.name">
                <Button
                  variant="ghost"
                  size="sm"
                  class="w-full justify-start gap-1.5 py-[4px] pl-[26px] pr-3 h-auto text-[11px]"
                  :class="
                    isStoreActive(db.name, store.name)
                      ? 'bg-secondary text-foreground font-medium border-l-2 border-foreground pl-[24px]'
                      : 'text-muted-foreground/60'
                  "
                  @click="navigateToStore(db.name, store.name)"
                >
                  <span class="truncate text-left">{{ store.name }}</span>
                  <span class="ml-auto text-[10px] font-mono text-muted-foreground/30 shrink-0">{{
                    store.recordCount
                  }}</span>
                </Button>
              </li>
            </ul>
          </li>
        </ul>
      </template>

      <!-- ── LocalStorage list ──────────────────────────────────── -->
      <template v-else-if="activeSection === 'localstorage'">
        <div class="flex h-7 shrink-0 items-center border-b border-border px-3">
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40"
          >
            {{ mockLocalStorageEntries.length }} keys
          </span>
        </div>
        <ul class="py-1">
          <li v-for="entry in mockLocalStorageEntries" :key="entry.key">
            <Button
              variant="ghost"
              size="sm"
              class="w-full justify-start gap-1.5 px-3 py-[5px] h-auto text-[11px] text-muted-foreground/60"
              @click="router.push(`/storage/localstorage?key=${encodeURIComponent(entry.key)}`)"
            >
              <HardDrive :size="11" class="shrink-0 opacity-50" />
              <span class="truncate text-left font-mono">{{ entry.key }}</span>
            </Button>
          </li>
        </ul>
      </template>

      <!-- ── Cache API tree ─────────────────────────────────────── -->
      <template v-else-if="activeSection === 'cache'">
        <div class="flex h-7 shrink-0 items-center border-b border-border px-3">
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40"
          >
            {{ mockCacheAPIEntries.length }} caches
          </span>
        </div>
        <ul class="py-1">
          <li v-for="cache in mockCacheAPIEntries" :key="cache.cacheName">
            <Button
              variant="ghost"
              size="sm"
              class="w-full justify-start gap-1.5 px-3 py-[5px] h-auto text-[12px] text-muted-foreground"
              @click="toggleCache(cache.cacheName)"
            >
              <component
                :is="expandedCaches.has(cache.cacheName) ? ChevronDown : ChevronRight"
                :size="11"
                class="shrink-0 opacity-50"
              />
              <Archive :size="12" class="shrink-0 opacity-50" />
              <span class="flex-1 truncate text-left">{{ cache.cacheName }}</span>
              <span class="text-[10px] font-mono text-muted-foreground/30 shrink-0">{{
                cache.entries.length
              }}</span>
            </Button>
            <ul v-if="expandedCaches.has(cache.cacheName)">
              <li v-for="entry in cache.entries" :key="entry.url">
                <Button
                  variant="ghost"
                  size="sm"
                  class="w-full justify-start gap-1.5 py-[4px] pl-[26px] pr-3 h-auto text-[11px] text-muted-foreground/60"
                  @click="
                    router.push(
                      `/storage/cache?cache=${encodeURIComponent(cache.cacheName)}&url=${encodeURIComponent(entry.url)}`,
                    )
                  "
                >
                  <span class="truncate text-left font-mono">{{ entry.url }}</span>
                  <span class="ml-auto text-[10px] font-mono text-muted-foreground/30 shrink-0">{{
                    entry.size
                  }}</span>
                </Button>
              </li>
            </ul>
          </li>
        </ul>
      </template>

      <!-- ── OPFS file list ─────────────────────────────────────── -->
      <template v-else-if="activeSection === 'opfs'">
        <div class="flex h-7 shrink-0 items-center border-b border-border px-3">
          <span
            class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/40"
          >
            {{ mockOPFSEntries.length }} entries
          </span>
        </div>
        <ul class="py-1">
          <li v-for="entry in mockOPFSEntries" :key="entry.name">
            <Button
              variant="ghost"
              size="sm"
              class="w-full justify-start gap-1.5 px-3 py-[5px] h-auto text-[11px] text-muted-foreground/60"
              @click="router.push(`/storage/opfs?file=${encodeURIComponent(entry.name)}`)"
            >
              <FolderOpen :size="11" class="shrink-0 opacity-50" />
              <span class="truncate text-left font-mono">{{ entry.name }}</span>
              <span class="ml-auto text-[10px] font-mono text-muted-foreground/30 shrink-0">{{
                entry.size
              }}</span>
            </Button>
          </li>
        </ul>
      </template>
    </div>
  </aside>
</template>
