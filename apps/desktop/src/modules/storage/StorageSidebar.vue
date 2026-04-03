<script setup lang="ts">
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  Database,
  HardDrive,
  Archive,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-vue-next";
import { useIDB } from "@/composables/useIDB";
import { useTargetsStore } from "@/stores/targets.store";

const router = useRouter();
const route = useRoute();
const targetsStore = useTargetsStore();
const { useDatabases } = useIDB();

const { data: databases, isLoading, isError, error } = useDatabases();
const expandedDbs = ref<Set<string>>(new Set());

function toggleDb(dbName: string) {
  expandedDbs.value.has(dbName) ? expandedDbs.value.delete(dbName) : expandedDbs.value.add(dbName);
}

function navigateToStore(dbName: string, storeName: string) {
  void router.push(`/storage/idb/${encodeURIComponent(dbName)}/${encodeURIComponent(storeName)}`);
}

function isStoreActive(dbName: string, storeName: string) {
  return route.params["db"] === dbName && route.params["store"] === storeName;
}

const storageLinks = [
  { to: "/storage/localstorage", icon: HardDrive, label: "LocalStorage" },
  { to: "/storage/cache", icon: Archive, label: "Cache API" },
  { to: "/storage/opfs", icon: FolderOpen, label: "OPFS" },
] as const;
</script>

<template>
  <aside class="flex w-[220px] shrink-0 flex-col border-r border-border overflow-hidden">
    <!-- IndexedDB section -->
    <div class="flex h-8 shrink-0 items-center border-b border-border px-3 gap-1.5">
      <Database :size="12" class="text-muted-foreground/40 shrink-0" />
      <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/50">
        IndexedDB
      </span>
    </div>

    <!-- IDB tree -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden">
      <!-- No target -->
      <div
        v-if="!targetsStore.selectedTarget"
        class="px-3 py-3 text-[11px] text-muted-foreground/40"
      >
        Connect to a target first
      </div>

      <!-- Loading -->
      <div
        v-else-if="isLoading"
        class="flex items-center gap-2 px-3 py-3 text-[11px] text-muted-foreground/50"
      >
        <Loader2 :size="12" class="animate-spin" />
        Loading…
      </div>

      <!-- Error -->
      <div v-else-if="isError" class="px-3 py-3 text-[11px] text-status-error">
        {{ error?.message }}
      </div>

      <!-- Empty -->
      <div
        v-else-if="databases && databases.length === 0"
        class="px-3 py-3 text-[11px] text-muted-foreground/40"
      >
        No databases found
      </div>

      <!-- Database tree -->
      <ul v-else class="py-1">
        <li v-for="db in databases" :key="db.name">
          <!-- DB row -->
          <button
            class="flex w-full items-center gap-1.5 px-2 py-[5px] text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none"
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
          </button>

          <!-- Store rows -->
          <ul v-if="expandedDbs.has(db.name)">
            <li v-for="store in db.objectStoreNames" :key="store">
              <button
                class="flex w-full items-center gap-1.5 py-[4px] pl-[26px] pr-2 text-[11px] transition-colors focus-visible:outline-none"
                :class="
                  isStoreActive(db.name, store)
                    ? 'bg-primary/10 text-primary font-medium border-l-2 border-primary pl-[24px]'
                    : 'text-muted-foreground/60 hover:bg-accent hover:text-accent-foreground'
                "
                @click="navigateToStore(db.name, store)"
              >
                <span class="truncate text-left">{{ store }}</span>
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </div>

    <!-- Other storage types -->
    <div class="shrink-0 border-t border-border py-1">
      <RouterLink
        v-for="link in storageLinks"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-2 px-3 py-[5px] text-[12px] transition-colors"
        :class="
          route.path.startsWith(link.to)
            ? 'text-primary bg-primary/10 border-l-2 border-primary pl-[10px]'
            : 'text-muted-foreground/60 hover:bg-accent hover:text-accent-foreground'
        "
      >
        <component :is="link.icon" :size="12" class="shrink-0" />
        {{ link.label }}
      </RouterLink>
    </div>
  </aside>
</template>
